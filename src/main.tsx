import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";

// The Vite PWA plugin registers the shared Workbox service worker.
// Customer and ERP installation identities remain separated by their manifests.

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </HelmetProvider>
);
