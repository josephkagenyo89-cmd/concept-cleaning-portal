import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import {
  getRegisteredRouteCount,
  scanCurrentPage,
  type DiagnosticFinding,
  type DiagnosticReport,
} from "@/lib/systemDiagnostics";
import {
  readMonitoringEvents,
  recordMonitoringEvent,
  startRuntimeMonitoring,
  subscribeToMonitoringUpdates,
  type MonitoringEvent,
} from "@/lib/systemMonitoring";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function severityClasses(severity: DiagnosticFinding["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "unverified":
      return "border-slate-500/30 bg-slate-500/10 text-muted-foreground";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
}

function severityLabel(severity: DiagnosticFinding["severity"]): string {
  return severity === "unverified" ? "Unverified" : severity.toUpperCase();
}

function eventLabel(type: MonitoringEvent["type"]): string {
  switch (type) {
    case "page_view":
      return "Monitoring page opened";
    case "scan_started":
      return "Diagnostic scan started";
    case "scan_completed":
      return "Diagnostic scan completed";
    case "runtime_error":
      return "JavaScript error";
    case "resource_error":
      return "Resource loading error";
    case "unhandled_rejection":
      return "Unhandled promise rejection";
    default:
      return type;
  }
}

export default function SystemMonitoring() {
  const location = useLocation();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [events, setEvents] = useState<MonitoringEvent[]>(() => readMonitoringEvents());
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const stopMonitoring = startRuntimeMonitoring();
    recordMonitoringEvent("page_view", "Opened System Monitoring.");

    const unsubscribe = subscribeToMonitoringUpdates(() => {
      setEvents(readMonitoringEvents());
    });

    return () => {
      unsubscribe();
      stopMonitoring();
    };
  }, []);

  useEffect(() => {
    recordMonitoringEvent("page_view", `Visited ${location.pathname}`);
  }, [location.pathname]);

  const runScan = () => {
    if (scanning) return;

    setScanning(true);
    recordMonitoringEvent("scan_started", "Started a scan of the currently rendered page.");

    try {
      const nextReport = scanCurrentPage();
      setReport(nextReport);
      recordMonitoringEvent(
        "scan_completed",
        `Scan completed: ${nextReport.linksChecked} links and ${nextReport.imagesChecked} images inspected; ${nextReport.findings.length} findings recorded.`,
      );
    } catch {
      recordMonitoringEvent("runtime_error", "The diagnostic scan could not be completed.");
    } finally {
      setScanning(false);
    }
  };

  const warnings = report?.findings.filter(
    (finding) => finding.severity === "warning" || finding.severity === "critical",
  ).length ?? 0;

  const unverified = report?.findings.filter(
    (finding) => finding.severity === "unverified",
  ).length ?? 0;

  const runtimeEvents = events.filter(
    (event) =>
      event.type === "runtime_error" ||
      event.type === "resource_error" ||
      event.type === "unhandled_rejection",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">System Monitoring</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Website diagnostics, browser errors and local monitoring activity.
          </p>
        </div>

        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Scan current page"}
        </button>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Phase 1 monitoring scope</p>
            <p className="text-muted-foreground">
              This version checks links and images found on the page currently open.
              It captures browser errors only while this monitoring page is active.
              Activity is stored in this browser tab and is not a shared visitor history.
              It does not inspect server-side functions, database health, or every
              authenticated workflow.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Registered routes</p>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{getRegisteredRouteCount()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Route patterns in the scanner registry</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Links checked</p>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{report?.linksChecked ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">On the most recently scanned page</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Issues detected</p>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{report ? warnings : "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Broken route links or failed images</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Browser errors</p>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{runtimeEvents.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Captured while this page was active</p>
        </div>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Page diagnostic results</h2>
          </div>
          {report && (
            <p className="text-xs text-muted-foreground">
              Last scan: {formatDate(report.scannedAt)} · {report.page}
            </p>
          )}
        </div>

        {!report ? (
          <div className="p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No scan has been run yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Select “Scan current page” to inspect its internal links and images.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border px-3 py-1">
                {report.linksChecked} links inspected
              </span>
              <span className="rounded-full border px-3 py-1">
                {report.imagesChecked} images inspected
              </span>
              <span className="rounded-full border px-3 py-1">
                {unverified} unverified
              </span>
            </div>

            {report.findings.map((finding) => (
              <div key={finding.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="break-all text-sm font-semibold">{finding.subject}</p>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${severityClasses(finding.severity)}`}>
                    {severityLabel(finding.severity)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{finding.detail}</p>
                <p className="mt-2 text-xs">
                  <span className="font-semibold">Suggested action: </span>
                  <span className="text-muted-foreground">{finding.recommendation}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Current browser session activity</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {events.length} of 100 recent events
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No activity has been recorded in this tab yet.
          </div>
        ) : (
          <div className="divide-y">
            {[...events].reverse().map((event) => (
              <div key={event.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{eventLabel(event.type)}</p>
                  <p className="break-words text-xs text-muted-foreground">{event.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.page}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(event.timestamp)}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          No automatic repairs are performed. External destinations are labelled
          unverified because browser security restrictions can prevent reliable
          availability checks. Route matching confirms a registered route pattern,
          not that a specific record or protected workflow exists.
        </p>
      </div>
    </div>
  );
}
