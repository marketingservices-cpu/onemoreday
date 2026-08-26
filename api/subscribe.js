/* POST /api/subscribe
 *
 * Body:  { email: string, source: "hero" | "footer", campaign?: string,
 *          early_reader?: boolean, website?: string }
 * Reply: { ok: true } | { ok: false }
 *
 * Vercel Node serverless function. No npm dependencies — global fetch only.
 *
 * This is a thin proxy: the real work (validation, honeypot, dedup and
 * rate limiting) happens in a dedicated signup endpoint that alone can
 * reach the signups table. The key below is the endpoint's public access
 * key — it grants no data access on its own; the table is unreachable
 * except through the endpoint. Override either value with env vars
 * SIGNUP_ENDPOINT / SIGNUP_KEY if the backend ever moves.
 *
 * A duplicate email is treated as success upstream, so a reader who signs
 * up twice still gets the kind message rather than an error.
 */

"use strict";

var SIGNUP_ENDPOINT =
  process.env.SIGNUP_ENDPOINT ||
  "https://czphffqwwvfpggxzeghy.supabase.co/functions/v1/omd-signup";

var SIGNUP_KEY =
  process.env.SIGNUP_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cGhmZnF3d3ZmcGdneHplZ2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjM1MjAsImV4cCI6MjA5ODc5OTUyMH0.SeAbmY2BnW7w1kgaogBW_L36cUlTdUArGJPgWJ5Nd8g";

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

/* Campaign tags arrive from the page URL (?src=...) — allow only a short,
   harmless slug so the list never stores junk. */
function cleanCampaign(value) {
  if (typeof value !== "string") { return null; }
  var slug = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  return slug !== "" ? slug : null;
}

function clientIp(req) {
  var forwarded = req.headers && req.headers["x-forwarded-for"];
  if (typeof forwarded !== "string" || forwarded === "") { return null; }
  var first = forwarded.split(",")[0].trim();
  return first !== "" ? first : null;
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
  var campaign = cleanCampaign(payload.campaign);

  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  try {
    var upstream = await fetch(SIGNUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + SIGNUP_KEY
      },
      body: JSON.stringify({
        email: email,
        source: source,
        campaign: campaign,
        early_reader: payload.early_reader === true,
        client_ip: clientIp(req)
      }),
      signal: controller.signal
    });

    if (upstream.ok) {
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
