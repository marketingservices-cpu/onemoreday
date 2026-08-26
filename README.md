# One More Day

The single-page site for the novel *One More Day*. Plain HTML, CSS and JavaScript —
no framework, no build step. Email signups are stored in a Supabase table via one
Vercel serverless function.

```
index.html        the page
styles.css        design system + layout
main.js           phase switching, config wiring, form handling
config.js         everything you'll want to change (see below)
api/subscribe.js  serverless function that stores a signup
```

## Running it locally

**Look at the page:** open `index.html` in a browser. Everything renders; the signup
form will show *"Something went wrong — please try again."* because there is no
`/api/subscribe` behind a plain file.

**Test the signup too:** run the Vercel CLI from this folder (`vercel dev`) with the
env vars below set. Nothing needs installing for the page itself.

## Environment variables

Set these on the Vercel project (and locally in `.env` if you use `vercel dev`).
Both are server-side only and are never sent to the browser.

| Variable | What it is |
| --- | --- |
| `SUPABASE_URL` | Your project URL, e.g. `https://xxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key |

The table the function writes to:

```sql
create table public.signups (
  id         bigint generated always as identity primary key,
  email      text not null,
  source     text,
  created_at timestamptz not null default now()
);

create unique index signups_email_key on public.signups (lower(email));
```

A repeat signup is treated as success, so someone who signs up twice still sees the
thank-you message rather than an error.

## config.js

Everything that changes over the life of the site lives in `config.js`.

| Key | Default | What it does |
| --- | --- | --- |
| `PHASE` | `1` | `1` = collect emails. `2` = sell the book. |
| `SHOW_AUTHOR_NAME` | `false` | `true` adds "One More Day is the debut novel of Chris Post." to the author section. |
| `RETAILER_LINKS` | `{ amazon: "#", more: "#" }` | Where the Phase 2 buy buttons point. |
| `FACEBOOK_URL` | the page URL | Used by both Facebook links. |

## Flipping to Phase 2 on launch day

1. Put the real URLs into `RETAILER_LINKS` in `config.js`.
2. Change `PHASE` to `2`.
3. Deploy.

That's the whole flip. The hero button becomes **Get your copy** and scrolls to the
retailers, "Be part of the story" is replaced by "Get your copy", and the email forms
step aside.

A safety rail: if `PHASE` is `2` but every retailer link is still `"#"`, the site stays
on Phase 1. It will never show a button that goes nowhere. Any single retailer link
left as `"#"` is simply hidden.
