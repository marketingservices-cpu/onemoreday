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

  SHOW_AUTHOR_NAME: false,

  /* Paste a link to the free first chapter (a PDF or a page) to switch the
     site into lead-magnet mode: the buttons become "Read the first chapter
     free" and readers get the chapter link the moment they sign up.
     Leave "" until the chapter exists. */
  LEAD_MAGNET_URL: "",

  RETAILER_LINKS: {
    amazon: "#",
    more: "#"
  },

  FACEBOOK_URL: "https://www.facebook.com/onemoredaypost"
};
