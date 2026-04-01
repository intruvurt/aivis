let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  // example: Google Analytics
  const script = document.createElement("script");
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX";
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  }
  gtag("js", new Date());
  gtag("config", "G-XXXXXXX", { anonymize_ip: true });
}
