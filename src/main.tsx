import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./lib/auth";
import { OrganizationProvider } from "./lib/orgContext";
import { TeamAccessProvider } from "./lib/teamAccess";
import { ToastProvider } from "./lib/toast";
import { runEnvironmentChecks } from "./lib/envCheck";
import { initMonitoring } from "./lib/monitoring";

// Startup diagnostics. Prints a compact table to the dev console and (in prod)
// stashes the result on window.__inferraEnv so support can inspect it in the
// field without a rebuild. Non-blocking — the app still boots even if some
// subsystem is unhealthy.
runEnvironmentChecks();

// Global error pipeline: window errors, unhandled rejections and auth failures
// flow to the console + optional beacon/adapter (see src/lib/monitoring.ts).
initMonitoring();

// Apply the per-device "reduce motion" preference (Settings → Appearance)
// before first paint so animations never flash on for users who disabled them.
try {
  if (localStorage.getItem("inferra_reduced_motion") === "1") {
    document.documentElement.classList.add("reduce-motion");
  }
} catch { /* storage unavailable — default to full motion */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <OrganizationProvider>
            <TeamAccessProvider>
              <App />
            </TeamAccessProvider>
          </OrganizationProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
