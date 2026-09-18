const UTM_KEY = 'ccs_utm';

export type UTMData = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

export function captureUTMParams() {
  const params = new URLSearchParams(window.location.search);

  const utm: UTMData = {
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    campaign: params.get('utm_campaign') || undefined,
    term: params.get('utm_term') || undefined,
    content: params.get('utm_content') || undefined,
  };

  if (Object.values(utm).some(Boolean)) {
    sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  }

  return utm;
}

export function getStoredUTM(): UTMData | null {
  try {
    const stored = sessionStorage.getItem(UTM_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
