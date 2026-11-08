export type MonitoringEventType =
  | "page_view"
  | "scan_started"
  | "scan_completed"
  | "runtime_error"
  | "resource_error"
  | "unhandled_rejection";

export interface MonitoringEvent {
  id: string;
  type: MonitoringEventType;
  timestamp: string;
  page: string;
  message: string;
}

const STORAGE_KEY = "ccs_system_monitoring_session_v1";
const SESSION_ID_KEY = "ccs_system_monitoring_session_id";
const MAX_EVENTS = 100;
const UPDATE_EVENT = "ccs-system-monitoring-updated";

function safePagePath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname.slice(0, 300);
}

function getSessionId(): string {
  if (typeof window === "undefined") return "server";

  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    return sessionId;
  } catch {
    return "session-storage-unavailable";
  }
}

function notifyUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

export function readMonitoringEvents(): MonitoringEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonitoringEvent[]) : [];
  } catch {
    return [];
  }
}

export function recordMonitoringEvent(
  type: MonitoringEventType,
  message: string,
): void {
  if (typeof window === "undefined") return;

  const event: MonitoringEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    page: safePagePath(),
    message: message.slice(0, 300),
  };

  try {
    const events = [...readMonitoringEvents(), event].slice(-MAX_EVENTS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    // The ID is generated for this browser tab only; it is not a device fingerprint.
    getSessionId();
  } catch {
    // Monitoring must never interrupt normal application use.
  }

  notifyUpdate();
}

export function subscribeToMonitoringUpdates(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(UPDATE_EVENT, callback);
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}

/**
 * Captures browser errors only while the monitoring page is mounted.
 * It deliberately does not capture form contents, passwords, payment data,
 * stack traces, or browser fingerprints.
 */
export function startRuntimeMonitoring(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleError = (event: Event) => {
    const target = event.target;

    if (target instanceof HTMLImageElement ||
        target instanceof HTMLScriptElement ||
        target instanceof HTMLLinkElement ||
        target instanceof HTMLIFrameElement) {
      const rawUrl =
        target instanceof HTMLLinkElement
          ? target.href
          : target.src;

      let safeUrl = "Resource URL unavailable";
      try {
        const url = new URL(rawUrl, window.location.href);
        safeUrl = url.origin === window.location.origin
          ? url.pathname
          : url.hostname;
      } catch {
        // Keep the generic label if the URL cannot be parsed.
      }

      recordMonitoringEvent("resource_error", `Failed resource: ${safeUrl}`);
      return;
    }

    if (event instanceof ErrorEvent) {
      const errorName =
        event.error instanceof Error &&
        /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(event.error.name)
          ? event.error.name
          : "JavaScriptError";

      recordMonitoringEvent(
        "runtime_error",
        `JavaScript error (${errorName}).`,
      );
    }
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const errorName =
      reason instanceof Error &&
      /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(reason.name)
        ? reason.name
        : "UnknownRejection";

    recordMonitoringEvent(
      "unhandled_rejection",
      `Unhandled promise rejection (${errorName}).`,
    );
  };

  window.addEventListener("error", handleError, true);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError, true);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
