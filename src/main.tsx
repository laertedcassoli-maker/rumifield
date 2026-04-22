import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Simple error logging
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', message, source, lineno, colno, error);
};

window.onunhandledrejection = (event) => {
  console.error('Unhandled rejection:', event.reason);
};

// Debug helper: detect elements causing horizontal overflow (logs in console)
const logHorizontalOverflow = () => {
  try {
    const viewportWidth = window.innerWidth;
    const offenders: Array<{ width: number; right: number; tag: string; className: string }> = [];

    document.querySelectorAll('body *').forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect?.();
      if (!rect) return;
      if (rect.right > viewportWidth + 1) {
        offenders.push({
          width: rect.width,
          right: rect.right,
          tag: (el as HTMLElement).tagName,
          className: (el as HTMLElement).className || '',
        });
      }
    });

    offenders.sort((a, b) => b.right - a.right);
    if (offenders.length > 0) {
      console.warn('[OverflowX] Elementos ultrapassando a tela:', {
        viewportWidth,
        top: offenders.slice(0, 10),
      });
    }
  } catch (e) {
    console.warn('[OverflowX] Falha ao detectar overflow', e);
  }
};

window.addEventListener('resize', () => setTimeout(logHorizontalOverflow, 50));
setTimeout(logHorizontalOverflow, 500);

// Unregister Service Worker in Lovable preview/iframe contexts to avoid
// stale cache and false offline detection. SW continues active in production.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  }).catch(() => {});
  // Also clear caches to drop any stale responses
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
