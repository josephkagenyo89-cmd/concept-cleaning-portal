const STORAGE_KEY = 'ccs_pending_guest_whatsapp_return';
const MAX_AGE_MS = 45 * 60 * 1000;

export type GuestWhatsAppRequest = {
  requestReference: string;
  serviceName: string;
  requestType: 'booking' | 'quotation';
  createdAt: number;
  leftAt?: number;
};

function clearPendingRequest() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable; never interrupt the user flow.
  }
}

export function rememberGuestWhatsAppRequest(
  request: Pick<GuestWhatsAppRequest, 'requestReference' | 'serviceName' | 'requestType'>
) {
  try {
    const pending: GuestWhatsAppRequest = {
      ...request,
      createdAt: Date.now(),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Storage must never interrupt a successfully saved request.
  }
}

export function markGuestWhatsAppDeparture() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const pending = JSON.parse(raw) as GuestWhatsAppRequest;

    if (
      !pending ||
      typeof pending.requestReference !== 'string' ||
      !pending.requestReference ||
      !Number.isFinite(pending.createdAt) ||
      Date.now() - pending.createdAt > MAX_AGE_MS
    ) {
      clearPendingRequest();
      return;
    }

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...pending, leftAt: Date.now() })
    );
  } catch {
    clearPendingRequest();
  }
}

export function consumeGuestWhatsAppReturn(): GuestWhatsAppRequest | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const pending = JSON.parse(raw) as GuestWhatsAppRequest;
    const now = Date.now();

    const valid =
      !!pending &&
      typeof pending.requestReference === 'string' &&
      pending.requestReference.length > 0 &&
      typeof pending.serviceName === 'string' &&
      (pending.requestType === 'booking' || pending.requestType === 'quotation') &&
      Number.isFinite(pending.createdAt) &&
      Number.isFinite(pending.leftAt) &&
      pending.leftAt! >= pending.createdAt &&
      pending.leftAt! <= now &&
      now - pending.createdAt <= MAX_AGE_MS;

    if (!valid) {
      clearPendingRequest();
      return null;
    }

    sessionStorage.removeItem(STORAGE_KEY);
    return pending;
  } catch {
    clearPendingRequest();
    return null;
  }
}
