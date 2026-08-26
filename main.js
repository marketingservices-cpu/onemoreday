/* One More Day — page behaviour.
 * Reads window.OMD_CONFIG (see config.js). No dependencies, no build step.
 */
(function () {
  "use strict";

  var DEFAULTS = {
    PHASE: 1,
    SHOW_AUTHOR_NAME: false,
    RETAILER_LINKS: {},
    FACEBOOK_URL: "https://www.facebook.com/onemoredaypost"
  };

  var cfg = window.OMD_CONFIG || {};
  var facebookUrl = cfg.FACEBOOK_URL || DEFAULTS.FACEBOOK_URL;
  var retailers = cfg.RETAILER_LINKS || DEFAULTS.RETAILER_LINKS;

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

      var decoy = form.querySelector('input[name="website"]');
      if (decoy) { payload.website = decoy.value; }

      send(payload).then(function (ok) {
        busy = false;
        button.disabled = false;
        button.textContent = idleLabel;

        if (ok) {
          form.setAttribute("hidden", "hidden");
          if (done) {
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

  /* Resolves true on success, false on anything else.
     Never rejects, never throws — a static local preview with no /api
     simply shows the error message. */
  function send(payload) {
    if (typeof window.fetch !== "function") {
      return Promise.resolve(false);
    }

    return window.fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
