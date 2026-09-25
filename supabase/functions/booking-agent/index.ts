// supabase/functions/booking-agent/index.ts
// Deno Edge Function — Intelligent Booking Agent using Groq
// v2: uses booking_engine_service_intelligence for matching,
//     booking_engine_attribute_prompts for structured clarifying questions,
//     booking_engine_flags for admin escalation.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Groq from "https://esm.sh/groq-sdk@0.9.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const groq = new Groq({ apiKey: Deno.env.get("GROQ_API_KEY") });

// Service-role client: bypasses RLS, used for admin-level reads/writes
// (service_intelligence lookups, attribute_prompts, flags, pricing RPC).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// User-scoped client factory: forwards the caller's own JWT so that
// auth.uid() resolves correctly inside RPCs like create_booking_engine_request
// and add_booking_engine_request_item, which require an authenticated user.
function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

interface DialogueMessage {
  role: "customer" | "agent";
  message: string;
  timestamp: string;
}

interface ExtractedFacts {
  service_category?: string;
  service_type?: string;
  key_attributes: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  requires_assessment: boolean;
  raw_understanding: string;
}

interface ServiceIntelligenceRow {
  id: string;
  primary_service_id: string;
  service_family: string;
  service_category: string | null;
  required_attributes: string[];
  optional_attributes: string[];
  disambiguation_attributes: string[];
  aliases: string[];
  keywords: string[];
  requires_photos: boolean;
  assessment_required: boolean;
  services: { id: string; name: string; pricing_model: string } | null;
}

interface ServiceMatch {
  service_id: string;
  service_name: string;
  confidence: number;
  reason: string;
  pricing_type?: string;
  missing_required_attributes: string[];
  requires_photos: boolean;
  assessment_required: boolean;
}

interface AttributePrompt {
  attribute_key: string;
  question_text: string;
  help_text: string | null;
  input_type: string;
  options: unknown[];
}

interface PricingResult {
  status: "priced" | "quotation_required" | "configuration_required";
  price?: number;
  currency?: string;
  subtotal?: number;
  discount_amount?: number;
  total?: number;
  message?: string;
}

interface BookingAgentRequest {
  requestId?: string;
  customerMessage: string;
  conversationHistory: DialogueMessage[];
  userId: string;
}

function toGroqMessages(history: DialogueMessage[], latest: string) {
  const messages: Array<{ role: "user" | "assistant"; content: string }> =
    history.map((msg) => ({
      role: msg.role === "agent" ? "assistant" : "user",
      content: msg.message,
    }));
  messages.push({ role: "user", content: latest });
  return messages;
}

// ---------- Groq: extraction ----------

async function extractCustomerIntent(
  customerMessage: string,
  conversationHistory: DialogueMessage[]
): Promise<ExtractedFacts> {
  const systemPrompt = `You are an intelligent booking assistant for Concept Cleaning Services in Nairobi.

Your ONLY job is to UNDERSTAND what the customer needs, NOT to choose services or make decisions.

For each customer message, extract and return JSON with:
{
  "service_category": "upholstery|pest_control|post_construction|carpet|car_interior|etc",
  "service_type": "more specific type or free-text description",
  "key_attributes": {
    "sofa_seater_count": number or null,
    "fabric_type": "microfiber|leather|standard|etc" or null,
    "property_bedrooms": number or null,
    "property_type": "apartment|house|commercial" or null,
    "pest_type": "cockroach|general|bedbug" or null,
    "carpet_dimensions": "4x6" or null,
    "carpet_size_sqm": number or null,
    "has_pets": boolean or null,
    "has_children": boolean or null,
    "condition_notes": "specific issues mentioned",
    "urgency": "today|this_week|flexible" or null
  },
  "confidence": "high|medium|low",
  "requires_assessment": boolean,
  "raw_understanding": "Brief explanation of what customer described"
}

RULES:
- Extract ONLY what customer explicitly said
- If customer is unclear, set confidence to "low"
- Keep raw_understanding to 1-2 sentences
- Merge with what has already been established in the conversation history — don't discard earlier facts

Return ONLY valid JSON, no markdown.`;

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: 500,
    response_format: { type: "json_object" },
    reasoning_effort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      ...toGroqMessages(conversationHistory, customerMessage),
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No content in Groq response");
  return JSON.parse(content) as ExtractedFacts;
}

// ---------- Service matching via booking_engine_service_intelligence ----------

interface ServiceAliasRow {
  alias_service_id: string;
  primary_service_id: string;
  match_confidence: number;
}

async function matchService(
  extractedFacts: ExtractedFacts
): Promise<ServiceMatch | null> {
  const { data: rows, error } = await supabase
    .from("booking_engine_service_intelligence")
    .select(
      `id, primary_service_id, service_family, service_category,
       required_attributes, optional_attributes, disambiguation_attributes,
       aliases, keywords, requires_photos, assessment_required,
       services:primary_service_id ( id, name, pricing_model )`
    )
    .returns<ServiceIntelligenceRow[]>();

  if (error || !rows || rows.length === 0) {
    console.error("service_intelligence load error:", error);
    return null;
  }

  // service_aliases maps one service (by name, via a separate service row)
  // to a primary service, e.g. "Sofa Shampooing" -> "Sofa Deep Clean".
  // We check whether the alias service's own name appears in the customer's
  // text, and if so treat that as a signal for its primary service.
  const { data: aliasRows } = await supabase
    .from("booking_engine_service_aliases")
    .select(
      `primary_service_id, match_confidence,
       alias_service:alias_service_id ( name )`
    )
    .returns<Array<{ primary_service_id: string; match_confidence: number; alias_service: { name: string } | null }>>();

  const haystackForAliases = [
    extractedFacts.service_category ?? "",
    extractedFacts.service_type ?? "",
    extractedFacts.raw_understanding ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const aliasBoostByPrimaryId = new Map<string, { score: number; term: string }>();
  for (const a of aliasRows || []) {
    const aliasName = a.alias_service?.name?.toLowerCase();
    if (aliasName && haystackForAliases.includes(aliasName)) {
      const existing = aliasBoostByPrimaryId.get(a.primary_service_id);
      const boost = a.match_confidence * 0.5; // scale into our scoring range
      if (!existing || boost > existing.score) {
        aliasBoostByPrimaryId.set(a.primary_service_id, { score: boost, term: a.alias_service!.name });
      }
    }
  }

  const haystack = [
    extractedFacts.service_category ?? "",
    extractedFacts.service_type ?? "",
    extractedFacts.raw_understanding ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let best: { row: ServiceIntelligenceRow; score: number; reason: string } | null = null;

  for (const row of rows) {
    let score = 0;
    const matchedTerms: string[] = [];

    if (
      extractedFacts.service_category &&
      row.service_category &&
      extractedFacts.service_category.toLowerCase() === row.service_category.toLowerCase()
    ) {
      score += 0.4;
      matchedTerms.push(`category:${row.service_category}`);
    }

    for (const kw of row.keywords || []) {
      if (kw && haystack.includes(kw.toLowerCase())) {
        score += 0.25;
        matchedTerms.push(kw);
      }
    }

    for (const alias of row.aliases || []) {
      if (alias && haystack.includes(alias.toLowerCase())) {
        score += 0.3;
        matchedTerms.push(alias);
      }
    }

    // Disambiguation attributes present in extracted facts boost confidence
    for (const attr of row.disambiguation_attributes || []) {
      if (
        extractedFacts.key_attributes[attr] !== undefined &&
        extractedFacts.key_attributes[attr] !== null
      ) {
        score += 0.15;
      }
    }

    // Alias-table boost: customer described this service by another known name
    const aliasBoost = aliasBoostByPrimaryId.get(row.primary_service_id);
    if (aliasBoost) {
      score += aliasBoost.score;
      matchedTerms.push(`alias:${aliasBoost.term}`);
    }

    score = Math.min(score, 1);

    if (!best || score > best.score) {
      best = {
        row,
        score,
        reason: matchedTerms.length
          ? `Matched on: ${matchedTerms.join(", ")}`
          : "No strong signal",
      };
    }
  }

  if (!best || best.score < 0.5 || !best.row.services) return null;

  const requiredAttrs = best.row.required_attributes || [];
  const missing = requiredAttrs.filter(
    (attr) =>
      extractedFacts.key_attributes[attr] === undefined ||
      extractedFacts.key_attributes[attr] === null
  );

  return {
    service_id: best.row.services.id,
    service_name: best.row.services.name,
    confidence: best.score,
    reason: best.reason,
    pricing_type: best.row.services.pricing_model,
    missing_required_attributes: missing,
    requires_photos: best.row.requires_photos,
    assessment_required: best.row.assessment_required,
  };
}

// ---------- Structured clarifying question via attribute_prompts ----------

async function getNextAttributePrompt(
  attributeKey: string
): Promise<AttributePrompt | null> {
  const { data, error } = await supabase
    .from("booking_engine_attribute_prompts")
    .select("attribute_key, question_text, help_text, input_type, options")
    .eq("attribute_key", attributeKey)
    .maybeSingle();

  if (error || !data) return null;
  return data as AttributePrompt;
}

// ---------- Groq: conversational fallback response ----------

async function generateAgentResponse(
  customerMessage: string,
  conversationHistory: DialogueMessage[],
  context: string
): Promise<string> {
  const systemPrompt = `You are a friendly, helpful booking assistant for Concept Cleaning Services in Nairobi.

Your job is to have a natural conversation with customers about their cleaning/pest control needs.

NEVER:
- Make pricing decisions
- Choose services
- Apologize for being AI

DO:
- Ask clarifying questions progressively (one question at a time)
- Confirm understanding: "So you need..."
- Be encouraging: "Great! Let me ask..."
- Use casual, local Kenyan English

Context: ${context}

Keep responses to 1-3 sentences (be concise).`;

  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: 200,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      ...toGroqMessages(conversationHistory, customerMessage),
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("No content in Groq response");
  return content;
}

// ---------- Pricing ----------

async function getPricingForService(
  userClient: ReturnType<typeof createClient>,
  itemId: string
): Promise<PricingResult> {
  const { data, error } = await userClient.rpc(
    "calculate_booking_engine_item_price",
    { p_request_item_id: itemId }
  );

  if (error) {
    return { status: "configuration_required", message: "Unable to calculate price" };
  }

  return {
    status: data.status || "configuration_required",
    price: data.total,
    currency: data.currency || "KES",
    subtotal: data.subtotal,
    discount_amount: data.discount_amount,
    total: data.total,
  };
}

// ---------- Booking request creation ----------

async function createDraftRequest(
  userClient: ReturnType<typeof createClient>
): Promise<string> {
  const { data: requestId, error } = await userClient.rpc(
    "create_booking_engine_request",
    {
      _requested_date: null,
      _requested_time: null,
      _service_location: null,
      _customer_notes: null,
    }
  );
  if (error) throw new Error(`Failed to create draft request: ${error.message}`);
  return requestId;
}

async function addServiceToRequest(
  userClient: ReturnType<typeof createClient>,
  requestId: string,
  matchedService: ServiceMatch,
  extractedFacts: ExtractedFacts,
  conversationHistory: DialogueMessage[]
): Promise<{ itemId: string }> {
  const { data: itemId, error: itemError } = await userClient.rpc(
    "add_booking_engine_request_item",
    {
      _request_id: requestId,
      _service_id: matchedService.service_id,
      _quantity: 1,
      _measurements: {},
      _answers: extractedFacts.key_attributes,
      _selected_extras: [],
    }
  );
  if (itemError) throw new Error(`Failed to add item: ${itemError.message}`);

  return { itemId };
}

// ---------- Flags (admin escalation) ----------

type FlagReason =
  | "unmatched_service"
  | "quotation_required"
  | "ambiguous_match"
  | "requires_assessment"
  | "high_value_booking"
  | "urgent_request";

async function createFlag(
  requestId: string,
  reason: FlagReason,
  priority: "critical" | "high" | "medium" | "low",
  title: string,
  extractedFacts: ExtractedFacts,
  photoCount = 0
) {
  const { error } = await supabase.from("booking_engine_flags").insert({
    request_id: requestId,
    reason,
    priority,
    title,
    extracted_facts: extractedFacts,
    photo_count: photoCount,
  });
  if (error) console.error("Failed to create flag:", error);
}

// ---------- Photo requirement ----------

function determinePhotoRequirement(
  pricingResult: PricingResult,
  matchedService: ServiceMatch | null,
  extractedFacts: ExtractedFacts
) {
  if (matchedService?.requires_photos) {
    return { required: true, reason: "requires_assessment" as const };
  }
  if (matchedService && matchedService.confidence > 0.7 && pricingResult.status === "priced") {
    return { required: false, reason: "straightforward_pricing" as const };
  }
  if (pricingResult.status === "quotation_required") {
    return { required: true, reason: "quotation_required" as const };
  }
  if (!matchedService || matchedService.confidence < 0.6) {
    return { required: true, reason: "unmatched_service" as const };
  }
  if (extractedFacts.requires_assessment || matchedService.assessment_required) {
    return { required: true, reason: "requires_assessment" as const };
  }
  return { required: false, reason: "straightforward_pricing" as const };
}

// ---------- Main handler ----------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createUserClient(authHeader);

    const body: BookingAgentRequest = await req.json();
    if (!body.customerMessage) {
      return new Response(JSON.stringify({ error: "Missing customer message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const history = body.conversationHistory || [];

    // Reuse the existing request if this is a continuing conversation,
    // otherwise create a draft one now so flags always have somewhere to attach.
    let requestId = body.requestId ?? null;
    if (!requestId) {
      requestId = await createDraftRequest(userClient);
    }

    const extractedFacts = await extractCustomerIntent(body.customerMessage, history);
    const matchedService = await matchService(extractedFacts);

    let pricingResult: PricingResult = { status: "configuration_required" };

    // Always persist the latest facts/transcript against the request, match or not
    await supabase
      .from("booking_engine_requests")
      .update({
        dialogue_transcript: history,
        extracted_facts: extractedFacts,
        original_customer_request: history[0]?.message ?? body.customerMessage,
      })
      .eq("id", requestId);

    // If we have a confident match with no missing required attributes, try to price it
    if (matchedService && matchedService.missing_required_attributes.length === 0) {
      try {
        const { itemId } = await addServiceToRequest(userClient, requestId, matchedService, extractedFacts, history);
        pricingResult = await getPricingForService(userClient, itemId);
      } catch (_err) {
        pricingResult = { status: "quotation_required", message: "Service needs assessment" };
      }
    }

    const photoRequirement = determinePhotoRequirement(pricingResult, matchedService, extractedFacts);

    // Escalate to admin flags table where relevant
    if (!matchedService) {
      await createFlag(requestId, "unmatched_service", "medium", "Could not match customer request to a service", extractedFacts);
    } else if (matchedService.confidence < 0.7) {
      await createFlag(requestId, "ambiguous_match", "medium", `Low-confidence match: ${matchedService.service_name}`, extractedFacts);
    }
    if (pricingResult.status === "quotation_required") {
      await createFlag(requestId, "quotation_required", "high", "Customer request requires manual quotation", extractedFacts);
    }
    if (extractedFacts.key_attributes.urgency === "today") {
      await createFlag(requestId, "urgent_request", "critical", "Customer needs service today", extractedFacts);
    }

    // Decide what to say next: ask a structured question for the next missing
    // required attribute if we have one, otherwise let Groq respond naturally.
    let agentMessage: string;
    if (matchedService && matchedService.missing_required_attributes.length > 0) {
      const nextAttr = matchedService.missing_required_attributes[0];
      const prompt = await getNextAttributePrompt(nextAttr);
      if (prompt) {
        agentMessage = prompt.help_text
          ? `${prompt.question_text} (${prompt.help_text})`
          : prompt.question_text;
      } else {
        agentMessage = await generateAgentResponse(
          body.customerMessage,
          history,
          `We matched the service "${matchedService.service_name}" but still need: ${nextAttr}.`
        );
      }
    } else {
      agentMessage = await generateAgentResponse(
        body.customerMessage,
        history,
        matchedService
          ? `Matched service: ${matchedService.service_name}. Pricing status: ${pricingResult.status}.`
          : "No service matched yet — help narrow down what the customer needs."
      );
    }

    const nextStep = photoRequirement.required ? "collect_photos" : "continue_dialogue";

    return new Response(
      JSON.stringify({
        status: "success",
        agentMessage,
        extractedFacts,
        matchedService: matchedService || undefined,
        pricingResult,
        photosRequired: photoRequirement.required,
        photoReason: photoRequirement.reason,
        nextStep,
        requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Booking agent error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        agentMessage: "Sorry, I had trouble processing that. Can you try again?",
        photosRequired: false,
        nextStep: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
