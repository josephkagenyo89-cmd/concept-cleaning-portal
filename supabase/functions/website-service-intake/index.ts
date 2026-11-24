import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("WEBSITE_ALLOWED_ORIGINS") ?? "https://concept-cleaning-kenya.lovable.app,https://conceptcleaningservices.co.ke,https://www.conceptcleaningservices.co.ke")
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

  let payload: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 32_000) return json({ error: "Request is too large" }, 413, origin);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request body" }, 400, origin);
  }

  const required = ["name", "phone", "location", "items"];
  if (required.some((key) => payload[key] == null)) return json({ error: "Missing required request details" }, 400, origin);
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 30) {
    return json({ error: "Select between 1 and 30 services" }, 400, origin);
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
