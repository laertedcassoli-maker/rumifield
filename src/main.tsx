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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
