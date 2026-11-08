import { matchPath } from "react-router-dom";

export type FindingSeverity = "critical" | "warning" | "info" | "unverified";

export interface DiagnosticFinding {
  id: string;
  severity: FindingSeverity;
  category: "route" | "anchor" | "image" | "external";
  subject: string;
  detail: string;
  recommendation: string;
}

export interface DiagnosticReport {
  scannedAt: string;
  page: string;
  linksChecked: number;
  imagesChecked: number;
  findings: DiagnosticFinding[];
}

const REGISTERED_ROUTES = [
  "/",
  "/blog",
  "/blog/:slug",
  "/privacy-policy",
  "/terms-and-conditions",
  "/marketplace",
  "/categories",
  "/service/:id",
  "/customer-auth",
  "/my",
  "/my/bookings",
  "/my/documents",
  "/my/messages",
  "/my/notifications",
  "/my/support",
  "/my/account",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/sign",
  "/.lovable/oauth/consent",
  "/admin",
  "/admin/system-monitoring",
  "/admin/approval-centre",
  "/admin/bookings",
  "/admin/bookings/:id",
  "/admin/discount-approvals",
  "/admin/discount-reports",
  "/admin/book-service",
  "/admin/quotations",
  "/admin/documents",
  "/admin/certificates",
  "/admin/agents",
  "/admin/commissions",
  "/admin/payouts",
  "/admin/services",
  "/admin/analytics",
  "/admin/leads",
  "/admin/leads/:id",
  "/admin/guest-requests",
  "/admin/clients",
  "/admin/clients/:id",
  "/admin/notices",
  "/admin/blog",
  "/admin/messages",
  "/admin/settings",
  "/admin/feedback",
  "/admin/pest",
  "/admin/pest/chemicals",
  "/admin/pest/revisits",
  "/admin/pest/:id",
  "/admin/hr",
  "/admin/hr/employees",
  "/admin/hr/employees/:id",
  "/admin/hr/departments",
  "/admin/hr/positions",
  "/admin/hr/payroll",
  "/admin/hr/payroll/:id",
  "/admin/erp",
  "/admin/erp/income",
  "/admin/erp/expenses",
  "/admin/erp/invoices",
  "/admin/erp/reports",
  "/agent",
  "/agent/book",
  "/agent/wallet",
  "/agent/messages",
  "/agent/profile",
] as const;

function normalizePath(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function isRegisteredRoute(pathname: string): boolean {
  const normalized = normalizePath(pathname);

  return REGISTERED_ROUTES.some((route) =>
    matchPath(
      { path: route, end: true, caseSensitive: false },
      normalized,
    ),
  );
}

function createFinding(
  finding: Omit<DiagnosticFinding, "id">,
  index: number,
): DiagnosticFinding {
  return { ...finding, id: `${finding.category}-${index}` };
}

/**
 * Inspects links and images present in the currently rendered document.
 * It does not crawl every route or make requests to external websites.
 */
export function scanCurrentPage(): DiagnosticReport {
  const findings: DiagnosticFinding[] = [];
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[href]"),
  );
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>("img[src]"),
  );

  let linksChecked = 0;
  let imagesChecked = 0;
  let findingIndex = 0;

  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute("href")?.trim();
    if (!rawHref) continue;

    if (
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:") ||
      rawHref.startsWith("javascript:") ||
      rawHref.startsWith("data:") ||
      rawHref.startsWith("blob:")
    ) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(rawHref, window.location.href);
    } catch {
      findings.push(
        createFinding(
          {
            severity: "warning",
            category: "route",
            subject: rawHref.slice(0, 180),
            detail: "This link could not be parsed as a valid URL.",
            recommendation: "Review the link destination in the page source.",
          },
          findingIndex++,
        ),
      );
      linksChecked++;
      continue;
    }

    if (url.origin !== window.location.origin) {
      findings.push(
        createFinding(
          {
            severity: "unverified",
            category: "external",
            subject: url.hostname,
            detail: "External destination found. Its availability was not tested.",
            recommendation: "Open the link separately to confirm that it works.",
          },
          findingIndex++,
        ),
      );
      linksChecked++;
      continue;
    }

    linksChecked++;

    if (url.hash && normalizePath(url.pathname) === normalizePath(window.location.pathname)) {
      let anchorId = "";
      try {
        anchorId = decodeURIComponent(url.hash.slice(1));
      } catch {
        anchorId = url.hash.slice(1);
      }

      if (anchorId && !document.getElementById(anchorId)) {
        findings.push(
          createFinding(
            {
              severity: "warning",
              category: "anchor",
              subject: `${url.pathname}${url.hash}`,
              detail: "The link points to an element that is not present on this page.",
              recommendation: "Check the target element ID or update the link.",
            },
            findingIndex++,
          ),
        );
      }
      continue;
    }

    if (!isRegisteredRoute(url.pathname)) {
      findings.push(
        createFinding(
          {
            severity: "warning",
            category: "route",
            subject: url.pathname,
            detail: "This internal destination does not match a registered application route.",
            recommendation: "Check the URL and confirm that the destination route exists.",
          },
          findingIndex++,
        ),
      );
    }
  }

  for (const image of images) {
    imagesChecked++;

    if (image.complete && image.naturalWidth === 0) {
      let subject = image.getAttribute("src") || "Unknown image";
      try {
        const url = new URL(subject, window.location.href);
        subject = url.origin === window.location.origin
          ? `${url.pathname}`
          : url.hostname;
      } catch {
        subject = subject.slice(0, 180);
      }

      findings.push(
        createFinding(
          {
            severity: "warning",
            category: "image",
            subject,
            detail: "The browser reports that this image failed to load.",
            recommendation: "Check that the image file exists and that its path is correct.",
          },
          findingIndex++,
        ),
      );
    } else if (!image.complete) {
      findings.push(
        createFinding(
          {
            severity: "unverified",
            category: "image",
            subject: image.getAttribute("src") || "Image",
            detail: "The image was still loading when the scan ran.",
            recommendation: "Run the scan again after the page has finished loading.",
          },
          findingIndex++,
        ),
      );
    }
  }

  if (findings.length === 0) {
    findings.push(
      createFinding(
        {
          severity: "info",
          category: "route",
          subject: "Current page",
          detail: "No broken internal route links or failed images were detected in the rendered page.",
          recommendation: "This result covers only the links and images discovered on this page.",
        },
        findingIndex++,
      ),
    );
  }

  return {
    scannedAt: new Date().toISOString(),
    page: window.location.pathname,
    linksChecked,
    imagesChecked,
    findings,
  };
}

export function getRegisteredRouteCount(): number {
  return REGISTERED_ROUTES.length;
}
