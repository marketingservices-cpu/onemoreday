// One More Day — signup endpoint. Called directly from the book site's signup forms.
// Auth: platform-verified JWT (public anon key) + all table access via service-role RPC only.
// CORS is open: this is a public newsletter-signup endpoint; abuse is contained by
// honeypot, validation, per-IP rate limiting, and dedup inside the RPC.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Telling a human a reader signed up. This project has no Resend key, no pg_net
// and no pg_cron — it can capture an email but it cannot send one — so the
// notification is handed to omd-signup-notify on the Card to Close project,
// which already sits beside the hardened mail helper. This side holds a shared
// secret and nothing else, so there is still exactly one Resend key to rotate.
//
// Until 2026-09-02 there was no notification at all: a signup wrote a row and
// stopped. The author announced the book that morning, and the first reader to
// raise a hand would have sat unseen in a table until someone ran a query.
const NOTIFY_URL = Deno.env.get("OMD_NOTIFY_URL") ?? "";
const NOTIFY_SECRET = Deno.env.get("OMD_NOTIFY_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/**
 * How many people have signed up, for the "total so far" line. Never throws.
 *
 * Through an RPC, not the table: the onemoreday schema is deliberately not
 * exposed through PostgREST — which is the whole reason writes go through
 * omd_add_signup — so reading it directly returns 406 and the line silently
 * vanished from the first notification we sent (2026-09-02).
 */
async function signupTotal(): Promise<number | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/omd_signup_count`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: "{}",
    });
    if (!res.ok) return null;
    const n = Number(await res.json());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort BY DESIGN. Capturing the reader is the job; telling us is the
 * courtesy — a slow or broken mail hop must never turn a successful signup into
 * an error the visitor sees, so this runs after the response and swallows
 * everything except a log line.
 */
async function notify(payload: Record<string, unknown>): Promise<void> {
  if (!NOTIFY_URL || !NOTIFY_SECRET) {
    console.error("[omd-signup] notification not configured — signup captured, nobody told");
    return;
  }
  try {
    const total = await signupTotal();
    const res = await fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, secret: NOTIFY_SECRET, total }),
    });
    if (!res.ok) console.error("[omd-signup] notify failed", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("[omd-signup] notify threw", String((e as Error)?.message || e).slice(0, 200));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false });

  let payload: {
    email?: string;
    source?: string;
    campaign?: string | null;
    early_reader?: boolean;
    website?: string;
    client_ip?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false });
  }

  // Honeypot: silently succeed so bots learn nothing.
  if (payload.website) return json(200, { ok: true });

  const email = (payload.email ?? "").trim();
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return json(400, { ok: false, reason: "invalid_email" });
  }

  const campaign =
    typeof payload.campaign === "string"
      ? payload.campaign.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || null
      : null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || payload.client_ip || "";
  const ipHash = ip ? await sha256Hex(`omd:${ip}`) : null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/omd_add_signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      p_email: email,
      p_source: (payload.source ?? "site").slice(0, 40),
      p_ip_hash: ipHash,
      p_early_reader: payload.early_reader === true,
      p_campaign: campaign,
    }),
  });

  if (!res.ok) {
    console.error("omd-signup rpc failed", res.status, await res.text());
    return json(500, { ok: false });
  }

  const result: string = await res.json();

  // Only a NEW reader is worth an email. A duplicate is someone signing up
  // twice, which is not news — and would otherwise let anyone generate mail on
  // demand by resubmitting the same address.
  if (result === "ok") {
    EdgeRuntime.waitUntil(notify({
      email,
      source: (payload.source ?? "site").slice(0, 40),
      early_reader: payload.early_reader === true,
      campaign,
    }));
  }

  // Duplicates read as success to the visitor — signing up twice is not an error.
  if (result === "ok" || result === "duplicate") return json(200, { ok: true });
  if (result === "rate_limited") return json(429, { ok: false, reason: "rate_limited" });
  return json(400, { ok: false, reason: "invalid_email" });
});
