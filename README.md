# One More Day

The single-page site for the novel *One More Day*. Plain HTML, CSS and JavaScript —
no framework, no build step, no server. The signup forms post straight to a dedicated
signup endpoint (see below), so the site can be hosted anywhere static files can.

```
index.html        the page
styles.css        design system + layout
main.js           phase switching, config wiring, form handling, floating CTA
config.js         everything you'll want to change (see below)
api/subscribe.js  optional serverless proxy — only needed on a host that runs
                  functions; the site does NOT use it (forms post directly)
```

## Running it locally

Open `index.html` in a browser, or serve the folder with any static server.
Everything works, including real signups — the forms talk to the live endpoint.

## Where signups go

Signups land in the `onemoreday.signups` table (isolated schema, RLS on, no
policies) behind the `omd-signup` edge function, which does validation, a
honeypot check, per-IP rate limiting, and dedup. The key in `config.js` is the
endpoint's public anon key: safe in the page, grants no table access on its own.
A repeat signup is treated as success — and if it newly ticks the early-reader
box, the existing row is upgraded rather than duplicated.

Columns: `email`, `source` (hero/footer), `campaign` (from `?src=` on the page
URL), `early_reader`, `created_at`.

## config.js

Everything that changes over the life of the site lives in `config.js`.

| Key | Default | What it does |
| --- | --- | --- |
| `PHASE` | `1` | `1` = collect emails. `2` = sell the book. |
| `SHOW_AUTHOR_NAME` | `false` | `true` adds "One More Day is the debut novel of Chris Post." to the author section. |
| `LEAD_MAGNET_URL` | `""` | Paste a link to the free first chapter to switch the buttons to "Read the first chapter free" and give signups the chapter link. |
| `RETAILER_LINKS` | `{ amazon: "#", more: "#" }` | Where the Phase 2 buy buttons point. |
| `FACEBOOK_URL` | the page URL | Used by both Facebook links. |
| `SIGNUP_URL` / `SIGNUP_KEY` | the live endpoint | Where the forms send signups. |

## Flipping to Phase 2 on launch day

1. Put the real URLs into `RETAILER_LINKS` in `config.js`.
2. Change `PHASE` to `2`.
3. Deploy.

That's the whole flip. The hero button becomes **Get your copy** and scrolls to the
retailers, the email forms step aside, and the floating button starts selling too.

A safety rail: if `PHASE` is `2` but every retailer link is still `"#"`, the site stays
on Phase 1. It will never show a button that goes nowhere. Any single retailer link
left as `"#"` is simply hidden.

## Still to add before public launch

- `og:image` — the preview picture Facebook shows when the link is shared.
- The real domain.
- Chris's sign-off on the balloon in the hero sky.
