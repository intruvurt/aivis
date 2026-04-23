import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';
import './i18n'; // Initialize i18n before rendering

import AppErrorBoundary from './components/AppErrorBoundary';
import {
  isRecoverableChunkError,
  markChunkBootSuccess,
  recoverFromChunkError,
} from './lib/chunkRecovery';
import { initSentryIfConsented } from './lib/sentry';
import { useAuthStore } from './stores/authStore';
import { initPostHog } from './lib/posthog';

initSentryIfConsented();
initPostHog();

// Handle stale chunk errors after deployments - auto-reload once.
window.addEventListener('vite:preloadError', () => {
  recoverFromChunkError();
});

window.addEventListener('error', (event) => {
  if (isRecoverableChunkError(event.error ?? event.message)) {
    recoverFromChunkError();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isRecoverableChunkError(event.reason)) {
    event.preventDefault();
    recoverFromChunkError();
  }
});

// Hydrate auth state from browser storage BEFORE rendering
useAuthStore.getState().hydrate();

(window as any).__AIVIS_BOOTSTRAPPED = true;
markChunkBootSuccess();

const boot = document.getElementById('boot');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);

if (boot) {
  requestAnimationFrame(() => {
    boot.style.opacity = '0';
    setTimeout(() => boot.remove(), 450);
  });
}
