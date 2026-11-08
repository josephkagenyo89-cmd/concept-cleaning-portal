import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const MAX_BODY_BYTES = 8192;
const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 900;

const BASE_ALLOWED_ORIGINS = [
  'https://conceptcleaningservices.co.ke',
  'https://www.conceptcleaningservices.co.ke',
  'https://conceptcleaning.co.ke',
  'https://www.conceptcleaning.co.ke',
  'https://conceptcleaningke.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const configuredOrigins = (Deno.env.get('GUEST_REQUEST_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([...BASE_ALLOWED_ORIGINS, ...configuredOrigins]);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

const json = (
  body: Record<string, unknown>,
  status = 200,
  origin: string | null = null,
) => new Response(JSON.stringify(body), {
  status,
  headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
});

const cleanText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

function todayNairobi(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isCalendarDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isCalendarDate && value >= todayNairobi();
}

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

async function readLimitedBody(req: Request): Promise<string> {
  const declaredLength = req.headers.get('content-length');

  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength) ||
        Number(declaredLength) > MAX_BODY_BYTES) {
      throw new Error('BODY_TOO_LARGE');
    }
  }

  if (!req.body) throw new Error('EMPTY_BODY');

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;

    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function hashClientIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(ip),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getClientIp(req: Request, supabaseUrl: string): string | null {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();

  if (cfIp && cfIp.length <= 64 && !/[\s,]/.test(cfIp)) {
    return cfIp;
  }

  // Local Supabase development only. Never use this fallback on hosted requests.
  let local = false;

  try {
    const host = new URL(supabaseUrl).hostname;
    local = host === 'localhost' || host === '127.0.0.1' || host === 'kong';
  } catch {
    local = false;
  }

  if (local) {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded && forwarded.length <= 64 ? forwarded : '127.0.0.1';
  }

  return null;
}

function calculateDiscount(
  basePrice: number,
  settingsValue: unknown,
): { final: number; discountAmount: number } {
  const defaults = {
    global_enabled: false,
    global_percentage: 0,
    start_date: '',
    end_date: '',
    label: '',
  };

  const stored = settingsValue && typeof settingsValue === 'object'
    ? settingsValue as Record<string, unknown>
    : {};

  const discount = { ...defaults, ...stored };
  const percentage = Math.min(
    100,
    Math.max(0, Number(discount.global_percentage) || 0),
  );

  const start = typeof discount.start_date === 'string'
    ? discount.start_date.trim()
    : '';

  const end = typeof discount.end_date === 'string'
    ? discount.end_date.trim()
    : '';

  const today = todayNairobi();
  const active = discount.global_enabled === true &&
    percentage > 0 &&
    (!start || start <= today) &&
    (!end || end >= today);

  const original = Math.max(0, Number(basePrice) || 0);

  if (!active || original <= 0) {
    return { final: original, discountAmount: 0 };
  }

  const discountAmount =
    Math.round(((original * percentage) / 100) * 100) / 100;

  return {
    final: Math.max(0, original - discountAmount),
    discountAmount,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = getCorsHeaders(origin);
  const reply = (body: Record<string, unknown>, status = 200) =>
    json(body, status, origin);

  if (origin && !cors['Access-Control-Allow-Origin']) {
    return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Vary': 'Origin' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return reply({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rateLimitSecret = Deno.env.get('GUEST_REQUEST_RATE_LIMIT_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return reply({ error: 'Service temporarily unavailable.' }, 500);
  }

  if (!rateLimitSecret || rateLimitSecret.length < 32) {
    return reply({ error: 'Request protection is not configured.' }, 503);
  }

  const clientIp = getClientIp(req, supabaseUrl);

  if (!clientIp) {
    return reply({ error: 'Request could not be securely verified. Please try again.' }, 503);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // HMAC prevents the rate-limit table from storing raw IP addresses.
    const ipHash = await hashClientIp(clientIp, rateLimitSecret);

    const { data: allowed, error: rateError } = await supabase.rpc(
      'consume_guest_service_request_rate_limit',
      {
        p_ip_hash: ipHash,
        p_max_requests: MAX_REQUESTS,
        p_window_seconds: WINDOW_SECONDS,
      },
    );

    if (rateError) {
      return reply({ error: 'Request service temporarily unavailable.' }, 503);
    }

    if (allowed !== true) {
      return reply({
        error: 'Too many requests. Please wait 15 minutes before trying again.',
      }, 429);
    }

    let body: Record<string, unknown>;

    try {
      const raw = await readLimitedBody(req);
      const parsed: unknown = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reply({ error: 'Invalid request data.' }, 400);
      }

      body = parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error && error.message === 'BODY_TOO_LARGE') {
        return reply({ error: 'Request is too large.' }, 413);
      }

      return reply({ error: 'Invalid request. Please check your details.' }, 400);
    }

    const requestType = cleanText(body.request_type, 20);
    const serviceId = cleanText(body.service_id, 100);
    const customerName = cleanText(body.customer_name, 120);
    const customerPhone = cleanText(body.customer_phone, 20);
    const customerNotes = cleanText(body.customer_notes, 1000);
    const location = cleanText(body.location, 180);
    const preferredDate = cleanText(body.preferred_date, 10);
    const preferredTime = cleanText(body.preferred_time, 5);

    const sizeSqm = body.size_sqm == null
      ? null
      : Number(body.size_sqm);

    if (!['booking', 'quotation'].includes(requestType)) {
      return reply({ error: 'Choose booking or quotation.' }, 400);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) {
      return reply({ error: 'Please select a valid service.' }, 400);
    }

    if (!/^\+[1-9]\d{7,14}$/.test(customerPhone)) {
      return reply({ error: 'A valid international phone number is required.' }, 400);
    }

    if (location.length < 2 ||
        !validDate(preferredDate) ||
        !validTime(preferredTime)) {
      return reply({ error: 'Complete the location, date and time fields correctly.' }, 400);
    }

    if (sizeSqm !== null &&
        (!Number.isFinite(sizeSqm) || sizeSqm <= 0)) {
      return reply({ error: 'Enter a valid service area.' }, 400);
    }

    // Resolve the service and its prices on the server.
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, name, category, is_active, base_price, price_per_sqm')
      .eq('id', serviceId)
      .maybeSingle();

    if (serviceError) {
      return reply({ error: 'Unable to validate the selected service.' }, 500);
    }

    if (!service || service.is_active !== true) {
      return reply({
        error: 'This service is currently unavailable. Please select another service.',
      }, 400);
    }

    const basePrice = Number(service.base_price) || 0;
    const pricePerSqm = Number(service.price_per_sqm) || 0;
    const perSqm = basePrice <= 0 && pricePerSqm > 0;

    if (perSqm && (sizeSqm === null || sizeSqm <= 0)) {
      return reply({ error: 'Enter the service area in square metres.' }, 400);
    }

    const originalPrice = perSqm
      ? pricePerSqm * (sizeSqm as number)
      : basePrice > 0
        ? basePrice
        : pricePerSqm;

    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      return reply({ error: 'The service price could not be calculated.' }, 400);
    }

    // Match the public hook: use the ERP discount row, or default settings.
    const { data: discountRow, error: discountError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('category', 'discount')
      .maybeSingle();

    if (discountError) {
      return reply({ error: 'Unable to verify current pricing. Please try again.' }, 503);
    }

    const discountResult = calculateDiscount(originalPrice, discountRow?.value);

    const { data: saved, error: insertError } = await supabase
      .from('guest_service_requests')
      .insert({
        request_type: requestType,
        service_id: String(service.id),
        service_name: service.name,
        service_category: service.category ?? null,
        customer_name: customerName || null,
        customer_phone: customerPhone,
        customer_notes: customerNotes || null,
        location,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        size_sqm: perSqm ? sizeSqm : null,
        estimated_amount: discountResult.final,
        discount_amount: discountResult.discountAmount,
      })
      .select('id, request_reference')
      .single();

    if (insertError || !saved) {
      return reply({ error: 'We could not save your request. Please try again.' }, 500);
    }

    return reply({
      success: true,
      id: saved.id,
      request_reference: saved.request_reference,
      service_name: service.name,
      estimated_amount: discountResult.final,
      discount_amount: discountResult.discountAmount,
    });
  } catch {
    return reply({ error: 'The request could not be processed. Please try again.' }, 500);
  }
});
