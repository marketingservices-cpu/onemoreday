/* POST /api/subscribe
 *
 * Body: { email: string, source: "hero" | "footer", website?: string }
 * Reply: { ok: true } | { ok: false }
 *
 * Vercel Node serverless function. No npm dependencies — global fetch only.
 *
 * Environment variables:
 *   SUPABASE_URL               e.g. https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service role key (server-side only, never shipped to the browser)
 *
 * Expected table:
 *   create table public.signups (
 *     id          bigint generated always as identity primary key,
 *     email       text not null,
 *     source      text,
 *     created_at  timestamptz not null default now()
 *   );
 *   create unique index signups_email_key on public.signups (lower(email));
 *
 * A duplicate email is treated as success, so a reader who signs up twice
 * still gets the kind message rather than an error.
 */

"use strict";

var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var MAX_EMAIL_LENGTH = 254;
var UPSTREAM_TIMEOUT_MS = 10000;

function readBody(req) {
  var body = req && req.body;

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (err) {
      return null;
    }
  }

  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8"));
    } catch (err) {
      return null;
    }
  }

  if (body && typeof body === "object") {
    return body;
  }

  return null;
}

function isValidEmail(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_EMAIL_LENGTH &&
    EMAIL_PATTERN.test(value)
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false });
    return;
  }

  var payload = readBody(req);
  if (!payload) {
    res.status(400).json({ ok: false });
    return;
  }

  // Honeypot. A person never sees this field, so anything in it is a bot.
  // Answer as though all is well and quietly write nothing.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    res.status(200).json({ ok: true });
    return;
  }

  var email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false });
    return;
  }

  var source = payload.source === "footer" ? "footer" : "hero";

  var baseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    console.error("subscribe: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set");
    res.status(500).json({ ok: false });
    return;
  }

  var endpoint = baseUrl.replace(/\/+$/, "") + "/rest/v1/signups";
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  try {
    var upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify({ email: email, source: source }),
      signal: controller.signal
    });

    // 409 covers the case where the unique index rejects the row outright
    // (i.e. when resolution=ignore-duplicates is not honoured).
    if (upstream.ok || upstream.status === 409) {
      res.status(200).json({ ok: true });
      return;
    }

    var detail = await upstream.text().catch(function () {
      return "";
    });
    console.error("subscribe: upstream responded " + upstream.status + " " + detail);
    res.status(500).json({ ok: false });
  } catch (err) {
    console.error("subscribe: request failed", err);
    res.status(500).json({ ok: false });
  } finally {
    clearTimeout(timer);
  }
};
