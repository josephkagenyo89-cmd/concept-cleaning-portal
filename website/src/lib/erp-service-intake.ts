
const ERP_SUBMISSION_STORAGE_KEY = "concept-cleaning:website-request-id";

type StoredSubmission = { id: string; fingerprint: string };

/**
 * Reuse an idempotency token only when the submitted request is unchanged.
 * If the customer edits the request after a failed attempt, issue a new token
 * so the ERP cannot mistake the changed request for the earlier submission.
 */
export function getERPSubmissionId(payload: Record<string, unknown>): string {
  const fingerprint = JSON.stringify(payload);
  try {
    const raw = sessionStorage.getItem(ERP_SUBMISSION_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredSubmission>;
      if (typeof stored.id === "string" && stored.fingerprint === fingerprint) {
        return stored.id;
      }
    }

    const id = crypto.randomUUID();
    sessionStorage.setItem(ERP_SUBMISSION_STORAGE_KEY, JSON.stringify({ id, fingerprint }));
    return id;
  } catch {
    throw new Error("Your browser could not save this request safely. Please enable session storage and try again.");
  }
}

export function clearERPSubmissionId(): void {
  try {
    sessionStorage.removeItem(ERP_SUBMISSION_STORAGE_KEY);
  } catch {
    // A successful request should not be reported as failed because storage cleanup failed.
  }
}

const ERP_INTAKE_URL = "https://bauvxqckhcymtdbttafv.supabase.co/functions/v1/website-service-intake";
const ERP_PUBLIC_KEY = import.meta.env.VITE_ERP_SUPABASE_ANON_KEY as string | undefined;

export interface ERPService {
  id: string;
  name: string;
  description: string;
  price_value: number;
  price_type: string;
  pricing_unit: string;
  category_id: string | null;
  category_name: string;
  is_active: boolean;
}

function getERPHeaders(): Record<string, string> {
  if (!ERP_PUBLIC_KEY?.trim()) {
    throw new Error("The service catalogue connection is not configured. Please contact Concept Cleaning Services.");
  }
  return {
    apikey: ERP_PUBLIC_KEY,
    Authorization: `Bearer ${ERP_PUBLIC_KEY}`,
    Accept: "application/json",
  };
}

export async function fetchERPServices(): Promise<ERPService[]> {
  const response = await fetch(ERP_INTAKE_URL, {
    method: "GET",
    headers: getERPHeaders(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Unable to load the service catalogue");
  return Array.isArray(body.services) ? body.services : [];
}

export async function submitERPServiceRequest(payload: Record<string, unknown>): Promise<{ request_reference: string }> {
  const response = await fetch(ERP_INTAKE_URL, {
    method: "POST",
    headers: {
      ...getERPHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success || !body.request_reference) {
    throw new Error(body.error || "Unable to submit your service request");
  }
  return body;
}
