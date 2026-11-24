import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Service temporarily unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("services")
      .select("id,name,description,base_price,pricing_model,pricing_unit,category_id,service_categories(name)")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) return json({ error: "Unable to load services" }, 500);

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
    return json({ services });
  }

  let payload: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 32_000) return json({ error: "Request is too large" }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const required = ["name", "phone", "location", "items"];
  if (required.some((key) => payload[key] == null)) return json({ error: "Missing required request details" }, 400);
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 30) {
    return json({ error: "Select between 1 and 30 services" }, 400);
  }

  const { data, error } = await admin.rpc("submit_website_service_request", { p_payload: payload });
  if (error) {
    const clientError = /required|allowed length|Invalid|Select between|quantity|duplicate|unavailable/i.test(error.message);
    return json({ error: clientError ? error.message : "Unable to submit your request. Please try again." }, clientError ? 400 : 500);
  }
  return json({ success: true, ...data }, 201);
});
