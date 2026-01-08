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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
