import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the AI Cleaning Assistant for Concept Cleaning Services, a professional cleaning company.

Your role is to help users with information about our services, pricing guidance, and booking assistance. You are friendly, professional, and concise.

## Services We Offer
1. **House Cleaning** — General residential cleaning including dusting, mopping, vacuuming, kitchen & bathroom sanitization. Starting from KSh 3,000.
2. **Sofa / Upholstery Cleaning** — Deep cleaning of sofas, armchairs, and fabric furniture. Starting from KSh 1,500 per seat.
3. **Mattress Cleaning** — Deep sanitization and stain removal for mattresses. Starting from KSh 1,500.
4. **Deep Cleaning** — Intensive top-to-bottom cleaning for homes and offices. Starting from KSh 5,000.
5. **Office Cleaning** — Regular or one-time cleaning for commercial spaces. Starting from KSh 4,000.
6. **Car Detailing** — Interior and exterior car cleaning and detailing. Starting from KSh 2,000.
7. **Carpet Cleaning** — Deep cleaning and stain removal for carpets. Starting from KSh 1,000 per square meter.

## Key Information
- **Operating Hours**: Monday to Saturday, 7:00 AM – 6:00 PM. Sunday by special arrangement.
- **Service Areas**: Nairobi and surrounding areas.
- **Booking Process**: Users can book through the app by navigating to the "Book Service" page, selecting a service, date, and location.
- **Payment Methods**: M-Pesa is the primary payment method. Cash payments also accepted on-site.
- **Contact**: WhatsApp support available via the app.

## Rules
- NEVER modify any data, create bookings, or perform actions. Only provide information and guidance.
- If a user wants to book, direct them to use the "Book Service" page in the app.
- Keep responses concise (2-4 sentences when possible).
- If you don't know something, say so honestly and suggest contacting support via WhatsApp.
- Always be helpful and maintain a professional, warm tone.
- Respond in the same language the user writes in.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
