/* One More Day — page behaviour.
 * Reads window.OMD_CONFIG (see config.js). No dependencies, no build step.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    PHASE: 1,
    SHOW_AUTHOR_NAME: false,
    RETAILER_LINKS: {},
    LEAD_MAGNET_URL: "",
    FACEBOOK_URL: "https://www.facebook.com/onemoredaypost"
  };

  var cfg = window.OMD_CONFIG || {};
  var facebookUrl = cfg.FACEBOOK_URL || DEFAULTS.FACEBOOK_URL;
  var retailers = cfg.RETAILER_LINKS || DEFAULTS.RETAILER_LINKS;
  var leadMagnetUrl = typeof cfg.LEAD_MAGNET_URL === "string" ? cfg.LEAD_MAGNET_URL.trim() : "";

  /* Which post or ad brought this reader here (?src=...). Stored with the
     signup so the author learns which posts actually fill the list. */
  var campaign = null;
  try {
    var srcParam = new URLSearchParams(window.location.search).get("src");
    if (srcParam) {
      var slug = srcParam.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
      if (slug !== "") { campaign = slug; }
    }
  } catch (err) { /* very old browser — campaign tracking just stays off */ }

  /* A retailer link only counts if it actually goes somewhere. */
  function isRealLink(href) {
    return typeof href === "string" && href.trim() !== "" && href.trim() !== "#";
  }

  function hasAnyRetailer() {
    for (var key in retailers) {
      if (Object.prototype.hasOwnProperty.call(retailers, key) && isRealLink(retailers[key])) {
        return true;
      }
    }
    return false;
  }

  /* Phase 2 needs somewhere to buy the book. Without a single working
     retailer link we stay on Phase 1 rather than show dead buttons. */
  var phase = (Number(cfg.PHASE) === 2 && hasAnyRetailer()) ? 2 : 1;

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  /* ---------- Phase ---------- */

  document.documentElement.setAttribute("data-phase", String(phase));

  each(".phase-1", function (el) {
    if (phase === 2) { el.setAttribute("hidden", "hidden"); }
  });

  each(".phase-2", function (el) {
    if (phase === 2) { el.removeAttribute("hidden"); }
  });

  /* ---------- Config-driven content ---------- */

  each("[data-facebook-link]", function (el) {
    el.setAttribute("href", facebookUrl);
  });

  if (cfg.SHOW_AUTHOR_NAME === true) {
    each("[data-author-name]", function (el) {
      el.removeAttribute("hidden");
    });
  }

  each("[data-retailer]", function (el) {
    var href = retailers[el.getAttribute("data-retailer")];
    if (phase === 2 && isRealLink(href)) {
      el.setAttribute("href", href.trim());
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "hidden");
    }
  });

  /* ---------- Email capture ---------- */

  var ERROR_MESSAGE = "Something went wrong — please try again.";
  var BUSY_LABEL = "Adding you…";
  var leadMagnetOn = isRealLink(leadMagnetUrl);

  /* Lead-magnet mode: the chapter is the invitation. */
  if (leadMagnetOn) {
    each(".signup__button", function (button) {
      button.textContent = "Read the first chapter free";
    });
  }

  var signedUp = false;

  each("[data-signup]", function (form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var errorBox = form.querySelector("[data-signup-error]");
    var done = form.parentNode.querySelector("[data-signup-done]");
    var idleLabel = button ? button.textContent : "";
    var busy = false;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (busy || !input || !button) { return; }

      errorBox.textContent = "";

      /* Basic client-side check first — the browser's own email validation,
         so the message the reader sees is their browser's, in their language. */
      if (typeof form.checkValidity === "function" && !form.checkValidity()) {
        if (typeof form.reportValidity === "function") {
          form.reportValidity();
        } else {
          input.focus();
        }
        return;
      }

      busy = true;
      button.disabled = true;
      button.textContent = BUSY_LABEL;

      var payload = {
        email: input.value.trim(),
        source: form.getAttribute("data-source") === "footer" ? "footer" : "hero"
      };

      if (campaign) { payload.campaign = campaign; }

      var earlyReader = form.querySelector('input[name="early_reader"]');
      if (earlyReader && earlyReader.checked) { payload.early_reader = true; }

      var decoy = form.querySelector('input[name="website"]');
      if (decoy) { payload.website = decoy.value; }

      send(payload).then(function (ok) {
        busy = false;
        button.disabled = false;
        button.textContent = idleLabel;

        if (ok) {
          signedUp = true;
          hideFloatCta();
          form.setAttribute("hidden", "hidden");
          if (done) {
            if (leadMagnetOn) {
              var lead = done.querySelector("[data-lead-link]");
              if (lead) {
                lead.setAttribute("href", leadMagnetUrl);
                lead.setAttribute("target", "_blank");
                lead.setAttribute("rel", "noopener");
                lead.removeAttribute("hidden");
              }
            }
            done.removeAttribute("hidden");
            if (typeof done.focus === "function") {
              done.setAttribute("tabindex", "-1");
              done.focus();
            }
          }
        } else {
          errorBox.textContent = ERROR_MESSAGE;
        }
      });
    });
  });

  /* ---------- Floating CTA ----------
     Appears once the hero scrolls away so joining is always one tap;
     steps aside while the join panel itself is on screen, and retires
     for good the moment the reader signs up. */

  var floatCta = document.querySelector("[data-float-cta]");
  var floatLink = document.querySelector("[data-float-link]");

  function hideFloatCta() {
    if (floatCta) { floatCta.setAttribute("hidden", "hidden"); }
  }

  (function () {
    if (!floatCta || !floatLink) { return; }

    if (phase === 2) {
      floatLink.setAttribute("href", "#buy");
      floatLink.textContent = "Get your copy";
    }

    var hero = document.querySelector(".hero");
    var target = document.querySelector(phase === 2 ? "#buy" : "#join");
    if (!hero || !target || typeof IntersectionObserver !== "function") { return; }

    var heroVisible = true;
    var targetVisible = false;

    function update() {
      if (signedUp || heroVisible || targetVisible) {
        floatCta.setAttribute("hidden", "hidden");
      } else {
        floatCta.removeAttribute("hidden");
      }
    }

    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      update();
    }, { threshold: 0.15 }).observe(hero);

    new IntersectionObserver(function (entries) {
      targetVisible = entries[0].isIntersecting;
      update();
    }, { threshold: 0.01 }).observe(target);
  })();

  /* Resolves true on success, false on anything else.
     Never rejects, never throws — if the endpoint is unreachable the
     reader simply sees the error message. */
  function send(payload) {
    if (typeof window.fetch !== "function" || !cfg.SIGNUP_URL || !cfg.SIGNUP_KEY) {
      return Promise.resolve(false);
    }

    return window.fetch(cfg.SIGNUP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.SIGNUP_KEY
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) { return false; }
      return response.json().then(function (data) {
        return !!(data && data.ok === true);
      }, function () {
        return false;
      });
    }, function () {
      return false;
    });
  }
})();
