/* One More Day — site configuration.
 *
 * Everything that changes between "waiting for the book" and "the book is out"
 * lives in this one file. No other file needs to be edited.
 *
 * PHASE 1 = collect email signups (pre-launch).
 * PHASE 2 = sell the book (launch day onward).
 *
 * Before setting PHASE to 2, fill in at least one RETAILER_LINKS entry.
 * If PHASE is 2 but every retailer link is still "#", the site stays on
 * Phase 1 rather than showing buttons that go nowhere.
 */
window.OMD_CONFIG = {
  PHASE: 1,

  SHOW_AUTHOR_NAME: true,

  /* Paste a link to the free first chapter (a PDF or a page) to switch the
     site into lead-magnet mode: the buttons become "Read the first chapter
     free" and readers get the chapter link the moment they sign up.
     Leave "" until the chapter exists. */
  LEAD_MAGNET_URL: "",

  RETAILER_LINKS: {
    amazon: "#",
    more: "#"
  },

  FACEBOOK_URL: "https://www.facebook.com/onemoredaypost",

  /* Where signups are sent. The key is the endpoint's public access key —
     safe to ship in the page; it grants no data access on its own. */
  SIGNUP_URL: "https://czphffqwwvfpggxzeghy.supabase.co/functions/v1/omd-signup",
  SIGNUP_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cGhmZnF3d3ZmcGdneHplZ2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjM1MjAsImV4cCI6MjA5ODc5OTUyMH0.SeAbmY2BnW7w1kgaogBW_L36cUlTdUArGJPgWJ5Nd8g"
};
