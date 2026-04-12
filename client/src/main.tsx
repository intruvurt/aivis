import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import "./i18n"; // Initialize i18n before rendering

import AppErrorBoundary from "./components/AppErrorBoundary";
import { initSentryIfConsented } from "./lib/sentry";
import { useAuthStore } from "./stores/authStore";

initSentryIfConsented();

// Handle stale chunk errors after deployments - auto-reload once
window.addEventListener('vite:preloadError', () => {
  const reloaded = sessionStorage.getItem('chunk-reload');
  if (!reloaded) {
    sessionStorage.setItem('chunk-reload', '1');
    window.location.reload();
  }
});

// Hydrate auth state from localStorage BEFORE rendering
useAuthStore.getState().hydrate();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
