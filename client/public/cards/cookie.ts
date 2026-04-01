/* cookie-consent.ts
   Minimal consent banner for AiVis
   - Necessary always on
   - Analytics optional (default off unless user accepts)
   - Stores state in localStorage
   - Respects DNT + GPC by defaulting analytics off
*/

(function () {
  "use strict";

  const STORAGE_KEY = "aivis_consent_v1";
  const VERSION = 1;

  // Detect privacy signals
  const dntEnabled =
    (typeof navigator.doNotTrack === "string" && navigator.doNotTrack === "1") ||
    (typeof window.doNotTrack === "string" && window.doNotTrack === "1") ||
    (typeof navigator.msDoNotTrack === "string" && navigator.msDoNotTrack === "1");

  const gpcEnabled = (typeof navigator.globalPrivacyControl === "boolean" && navigator.globalPrivacyControl === true);

  const defaultConsent = {
    version: VERSION,
    necessary: true,
    analytics: false,
    marketing: false,
    updatedAt: null,
    source: "default",
    signals: {
      dnt: !!dntEnabled,
      gpc: !!gpcEnabled
    }
  };

  function nowISO() {
    try {
      return new Date().toISOString();
    } catch {
      return null;
    }
  }

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function readConsent() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== VERSION) return null;
    if (typeof parsed.necessary !== "boolean") return null;
    if (typeof parsed.analytics !== "boolean") return null;
    if (typeof parsed.marketing !== "boolean") return null;
    return parsed;
  }

  function writeConsent(consent) {
    const payload = {
      version: VERSION,
      necessary: true,
      analytics: !!consent.analytics,
      marketing: !!consent.marketing,
      updatedAt: nowISO(),
      source: consent.source || "user",
      signals: {
        dnt: !!dntEnabled,
        gpc: !!gpcEnabled
      }
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    // Notify the app + any scripts that want to listen
    try {
      window.dispatchEvent(new CustomEvent("aivis:consent", { detail: payload }));
      window.dispatchEvent(new CustomEvent("aivis:consent:updated", { detail: payload }));
    } catch { /* ignore dispatch errors */ }

    // Also set a lightweight cookie for server-side use if needed (optional)
    // Set to Lax, not cross-site
    try {
      document.cookie =
        "aivis_consent=" +
        encodeURIComponent(JSON.stringify({ a: payload.analytics ? 1 : 0, m: payload.marketing ? 1 : 0, v: VERSION })) +
        "; Path=/; Max-Age=31536000; SameSite=Lax";
    } catch { /* ignore cookie errors */ }

    return payload;
  }

  function applyConsent(consent) {
    // Put consent flags on <html> for CSS hooks if needed
    try {
      document.documentElement.dataset.consentAnalytics = consent.analytics ? "1" : "0";
      document.documentElement.dataset.consentMarketing = consent.marketing ? "1" : "0";
    } catch { /* ignore DOM errors */ }

    // Provide a stable global for your app
    window.AiVisConsent = {
      get: () => readConsent() || consent,
      set: (next) => writeConsent({ ...consent, ...next, source: "api" }),
      open: () => openPreferences(),
      reset: () => {
        localStorage.removeItem(STORAGE_KEY);
        try { document.cookie = "aivis_consent=; Path=/; Max-Age=0; SameSite=Lax"; } catch { /* ignore */ }
        location.reload();
      }
    };

    // Hook point: if you use analytics, load it only when consent.analytics === true
    // Example:
    // if (consent.analytics) { loadPlausible(); }
  }

  // If DNT/GPC are enabled, we keep analytics off by default.
  function initialConsent() {
    const saved = readConsent();
    if (saved) return saved;

    const consent = { ...defaultConsent };
    if (dntEnabled || gpcEnabled) {
      consent.analytics = false;
      consent.marketing = false;
      consent.source = "privacy-signal";
    }
    return consent;
  }

  // UI
  let ui = null;

  function injectStyles() {
    const css = `
#aivis-consent-root{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
#aivis-consent-card{max-width:980px;margin:0 auto;background:rgba(10,7,20,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.55);backdrop-filter:blur(10px);overflow:hidden}
#aivis-consent-inner{display:grid;grid-template-columns:1fr;gap:12px;padding:14px 14px 12px}
@media (min-width:880px){#aivis-consent-inner{grid-template-columns:1.4fr .9fr;align-items:center}}
#aivis-consent-title{font-size:14px;font-weight:650;letter-spacing:.2px;margin:0 0 4px}
#aivis-consent-text{font-size:13px;line-height:1.35;margin:0;color:rgba(255,255,255,.82)}
#aivis-consent-links{margin-top:8px;font-size:12px;color:rgba(255,255,255,.72)}
#aivis-consent-links a{color:rgba(255,255,255,.86);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
#aivis-consent-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-start}
@media (min-width:880px){#aivis-consent-actions{justify-content:flex-end}}
.aivis-btn{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:10px 12px;font-size:13px;cursor:pointer}
.aivis-btn:hover{background:rgba(255,255,255,.12)}
.aivis-btn-primary{border-color:rgba(124,76,225,.8);background:rgba(124,76,225,.9)}
.aivis-btn-primary:hover{background:rgba(124,76,225,1)}
.aivis-btn-ghost{background:transparent}
#aivis-consent-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:18px;z-index:2147483647}
#aivis-consent-modal[data-open="1"]{display:flex}
#aivis-consent-modal-card{width:min(720px,100%);background:#0b0714;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 18px 70px rgba(0,0,0,.65);overflow:hidden}
#aivis-consent-modal-head{padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,.10)}
#aivis-consent-modal-head h3{margin:0;font-size:14px;font-weight:700}
#aivis-consent-modal-body{padding:12px 14px;display:grid;gap:10px}
.aivis-row{display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(255,255,255,.04)}
.aivis-row h4{margin:0;font-size:13px;font-weight:700}
.aivis-row p{margin:2px 0 0;font-size:12px;line-height:1.35;color:rgba(255,255,255,.78)}
.aivis-switch{margin-left:auto;display:flex;align-items:center;gap:8px}
.aivis-switch input{width:18px;height:18px}
#aivis-consent-modal-foot{padding:12px 14px;border-top:1px solid rgba(255,255,255,.10);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
`;
    const style = document.createElement("style");
    style.setAttribute("data-aivis-consent-style", "1");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function renderBanner(consent) {
    const root = document.createElement("div");
    root.id = "aivis-consent-root";

    root.innerHTML = `
      <div id="aivis-consent-card" role="dialog" aria-live="polite" aria-label="Cookie consent">
        <div id="aivis-consent-inner">
          <div>
            <p id="aivis-consent-title">Cookies and privacy</p>
            <p id="aivis-consent-text">
              AiVis uses essential cookies to run the site. With your permission, we also use analytics to understand usage and improve performance.
            </p>
            <div id="aivis-consent-links">
              <a href="/privacy" rel="nofollow">Privacy</a>
              <span> · </span>
              <a href="/cookies" rel="nofollow">Cookie policy</a>
              ${gpcEnabled ? `<span> · Global Privacy Control detected</span>` : ``}
              ${dntEnabled ? `<span> · Do Not Track enabled</span>` : ``}
            </div>
          </div>

          <div id="aivis-consent-actions">
            <button class="aivis-btn aivis-btn-ghost" type="button" data-action="customize">Customize</button>
            <button class="aivis-btn" type="button" data-action="reject">Reject non-essential</button>
            <button class="aivis-btn aivis-btn-primary" type="button" data-action="accept">Accept</button>
          </div>
        </div>
      </div>

      <div id="aivis-consent-modal" role="dialog" aria-modal="true" aria-label="Cookie preferences">
        <div id="aivis-consent-modal-card">
          <div id="aivis-consent-modal-head">
            <h3>Cookie preferences</h3>
          </div>

          <div id="aivis-consent-modal-body">
            <div class="aivis-row">
              <div>
                <h4>Necessary</h4>
                <p>Required for basic site functions, security, and your settings. Always on.</p>
              </div>
              <div class="aivis-switch">
                <input type="checkbox" checked disabled aria-label="Necessary cookies always on" />
              </div>
            </div>

            <div class="aivis-row">
              <div>
                <h4>Analytics</h4>
                <p>Helps us measure traffic and improve the product. No ads. No selling your data.</p>
              </div>
              <div class="aivis-switch">
                <input id="aivis-consent-analytics" type="checkbox" ${consent.analytics ? "checked" : ""} aria-label="Analytics cookies" />
              </div>
            </div>

            <div class="aivis-row">
              <div>
                <h4>Marketing</h4>
                <p>Not used by default. Enable only if you run ads/retargeting later.</p>
              </div>
              <div class="aivis-switch">
                <input id="aivis-consent-marketing" type="checkbox" ${consent.marketing ? "checked" : ""} aria-label="Marketing cookies" />
              </div>
            </div>
          </div>

          <div id="aivis-consent-modal-foot">
            <button class="aivis-btn" type="button" data-action="close">Cancel</button>
            <button class="aivis-btn aivis-btn-primary" type="button" data-action="save">Save preferences</button>
          </div>
        </div>
      </div>
    `;

    return root;
  }

  function openPreferences() {
    if (!ui) return;
    const modal = ui.querySelector("#aivis-consent-modal");
    if (modal) modal.setAttribute("data-open", "1");
  }

  function closePreferences() {
    if (!ui) return;
    const modal = ui.querySelector("#aivis-consent-modal");
    if (modal) modal.removeAttribute("data-open");
  }

  function removeUI() {
    if (ui && ui.parentNode) ui.parentNode.removeChild(ui);
    ui = null;
  }

  function shouldShowBanner(consent) {
    // If no saved consent, show banner.
    const saved = readConsent();
    if (!saved) return true;
    return false;
  }

  function init() {
    const consent = initialConsent();

    // Apply what we have (even before prompt) so the app can read it
    applyConsent(consent);

    // If already saved, do not show banner
    if (!shouldShowBanner(consent)) return;

    // If privacy signals are on, we still show a banner (but user can accept)
    injectStyles();
    ui = renderBanner(consent);
    document.body.appendChild(ui);

    // Events
    ui.addEventListener("click", function (e) {
      const btn = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
      if (!btn) return;

      const action = btn.getAttribute("data-action");

      if (action === "accept") {
        writeConsent({ analytics: true, marketing: false, source: "accept-all" });
        removeUI();
        return;
      }

      if (action === "reject") {
        writeConsent({ analytics: false, marketing: false, source: "reject-nonessential" });
        removeUI();
        return;
      }

      if (action === "customize") {
        openPreferences();
        return;
      }

      if (action === "close") {
        closePreferences();
        return;
      }

      if (action === "save") {
        const a = ui.querySelector("#aivis-consent-analytics");
        const m = ui.querySelector("#aivis-consent-marketing");
        writeConsent({
          analytics: !!(a && a.checked),
          marketing: !!(m && m.checked),
          source: "custom"
        });
        removeUI();
        return;
      }
    });

    // Esc closes modal
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePreferences();
    });
  }

  // Run once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
