import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("WEBSITE_ALLOWED_ORIGINS") ?? "https://concept-cleaning-kenya.lovable.app,https://conceptcleaningservices.co.ke,https://www.conceptcleaningservices.co.ke,http://localhost:8080,http://127.0.0.1:8080")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

async function hashClientIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(ip),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.includes(origin)) return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Service temporarily unavailable" }, 503, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("services")
      .select("id,name,description,base_price,pricing_model,pricing_unit,category_id,service_categories(name)")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) return json({ error: "Unable to load services" }, 500, origin);

    const services = (data ?? []).map((service: any) => ({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      price_value: Number(service.base_price ?? 0),
      price_type: service.pricing_model,
      pricing_unit: service.pricing_unit,
      category_id: service.category_id,
      category_name: service.service_categories?.name ?? "Other",
      is_active: true,
    }));
    return json({ services }, 200, origin);
  }

  // Reuse the production guest-request limiter. Store only an HMAC of the
  // client IP; never persist the raw address.
  const rateLimitSecret = Deno.env.get("GUEST_REQUEST_RATE_LIMIT_SECRET");
  const clientIp = req.headers.get("cf-connecting-ip")?.trim();
  if (!rateLimitSecret || rateLimitSecret.length < 32 || !clientIp ||
      clientIp.length > 64 || /[\\s,]/.test(clientIp)) {
    return json({ error: "Request protection is temporarily unavailable." }, 503, origin);
  }

  const ipHash = await hashClientIp(clientIp, rateLimitSecret);
  const { data: allowed, error: rateLimitError } = await admin.rpc(
    "consume_guest_service_request_rate_limit",
    { p_ip_hash: ipHash, p_max_requests: 5, p_window_seconds: 900 },
  );
  if (rateLimitError) return json({ error: "Request service temporarily unavailable." }, 503, origin);
  if (allowed !== true) return json({ error: "Too many requests. Please wait 15 minutes before trying again." }, 429, origin);

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > 32_000) return json({ error: "Request is too large" }, 413, origin);

  let payload: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 32_000) return json({ error: "Request is too large" }, 413, origin);
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ error: "Invalid request body" }, 400, origin);
    }
  } catch {
    return json({ error: "Invalid request body" }, 400, origin);
  }

  const requiredText = ["name", "phone", "location"];
  if (requiredText.some((key) => typeof payload[key] !== "string" || !(payload[key] as string).trim())) {
    return json({ error: "Name, phone and service location are required." }, 400, origin);
  }
  if ((payload.name as string).trim().length > 160 ||
      (payload.phone as string).trim().length > 40 ||
      (payload.location as string).trim().length > 500 ||
      (typeof payload.email === "string" && payload.email.length > 254) ||
      (typeof payload.instructions === "string" && payload.instructions.length > 4000)) {
    return json({ error: "A customer field exceeds the allowed length." }, 400, origin);
  }
  if (!["guest", "registered"].includes(String(payload.customer_type || "guest"))) {
    return json({ error: "Invalid customer type." }, 400, origin);
  }
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 30) {
    return json({ error: "Select between 1 and 30 services" }, 400, origin);
  }
  const itemIds = new Set<string>();
  for (const item of payload.items) {
    if (!item || typeof item.service_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.service_id) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 ||
        itemIds.has(item.service_id)) {
      return json({ error: "Each selected service must be valid, unique and have a quantity from 1 to 100." }, 400, origin);
    }
    itemIds.add(item.service_id);
  }
  if (payload.preferred_date != null &&
      (typeof payload.preferred_date !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(payload.preferred_date))) {
    return json({ error: "Preferred date must use YYYY-MM-DD." }, 400, origin);
  }
  if (payload.selected_assets != null && !Array.isArray(payload.selected_assets)) {
    return json({ error: "Invalid selected property items." }, 400, origin);
  }

  if (typeof payload.client_submission_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.client_submission_id)) {
    return json({ error: "Invalid submission token. Please refresh and try again." }, 400, origin);
  }

  const { data, error } = await admin.rpc("submit_website_service_request", { p_payload: payload });
  if (error) {
    const clientError = /required|allowed length|Invalid|Select between|quantity|duplicate|unavailable/i.test(error.message);
    return json({ error: clientError ? error.message : "Unable to submit your request. Please try again." }, clientError ? 400 : 500, origin);
  }
  return json({ success: true, ...data }, data?.duplicate ? 200 : 201, origin);
});
