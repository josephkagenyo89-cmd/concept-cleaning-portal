/**
 * INTELLIGENT BOOKING AGENT API ROUTE
 * POST /api/booking-agent
 * Uses Groq API (free tier)
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

interface ServiceMatch {
  service_id: string;
  service_name: string;
  confidence: number;
  reason: string;
  pricing_type?: string;
}

interface PricingResult {
  status: "priced" | "quotation_required" | "configuration_required";
  price?: number;
  currency?: string;
  subtotal?: number;
  discount_amount?: number;
  total?: number;
  requires_measurement?: string[];
  message?: string;
}

interface BookingAgentRequest {
  requestId?: string;
  customerMessage: string;
  conversationHistory: DialogueMessage[];
  userId: string;
}

interface BookingAgentResponse {
  status: "success" | "error";
  agentMessage: string;
  extractedFacts?: ExtractedFacts;
  matchedService?: ServiceMatch;
  pricingResult?: PricingResult;
  photosRequired: boolean;
  photoReason?: string;
  nextStep: "continue_dialogue" | "collect_photos" | "submit_request" | "error";
  requestId?: string;
  requestItemId?: string;
}

// Extract customer intent using Groq
async function extractCustomerIntent(
  customerMessage: string,
  conversationHistory: DialogueMessage[]
): Promise<ExtractedFacts> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = conversationHistory.map((msg) => ({
    role: msg.role === "agent" ? "assistant" : "user",
    content: msg.message,
  }));

  messages.push({
    role: "user",
    content: customerMessage,
  });

  const systemPrompt = `You are an intelligent booking assistant for Concept Cleaning Services in Nairobi.

Your ONLY job is to UNDERSTAND what the customer needs, NOT to choose services or make decisions.

For each customer message, extract and return JSON with:
{
  "service_category": "upholstery|pest_control|post_construction|carpet|car_interior|etc",
  "service_type": "more specific type",
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

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await groq.chat.completions.create({
      model: "mixtral-8x7b-32768",
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in Groq response");
    }

    const extracted: ExtractedFacts = JSON.parse(content);
    return extracted;
  } catch (error) {
    console.error("Groq extraction error:", error);
    throw new Error("Failed to understand customer request");
  }
}

// Generate Groq's conversational response
async function generateAgentResponse(
  customerMessage: string,
  conversationHistory: DialogueMessage[],
  extractedFacts: ExtractedFacts,
  matchedService?: ServiceMatch,
  pricingResult?: PricingResult
): Promise<string> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = conversationHistory.map((msg) => ({
    role: msg.role === "agent" ? "assistant" : "user",
    content: msg.message,
  }));

  messages.push({
    role: "user",
    content: customerMessage,
  });

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

Keep responses to 1-3 sentences (be concise).`;

  try {
    const response = await groq.chat.completions.create({
      model: "mixtral-8x7b-32768",
      max_tokens: 200,
      system: systemPrompt,
      messages: messages,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in Groq response");
    }

    return content;
  } catch (error) {
    console.error("Groq response generation error:", error);
    throw new Error("Failed to generate response");
  }
}

// Match extracted facts against 191 existing services
async function matchServiceDeterministic(
  extractedFacts: ExtractedFacts
): Promise<ServiceMatch | null> {
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, name, category, base_price, pricing_model, description")
    .eq("is_active", true);

  if (servicesError || !services || services.length === 0) {
    console.error("Failed to load services:", servicesError);
    return null;
  }

  let bestMatch: ServiceMatch | null = null;
  let bestScore = 0;

  for (const service of services) {
    let score = 0;
    let matchReason = "";
    const serviceLower = service.name.toLowerCase();

    // SOFA CLEANING
    if (
      extractedFacts.service_category === "upholstery" ||
      extractedFacts.service_type?.includes("sofa")
    ) {
      if (serviceLower.includes("sofa")) {
        score += 0.8;
        matchReason = "Service name matches sofa cleaning";

        if (extractedFacts.key_attributes.sofa_seater_count) {
          const seatCount = extractedFacts.key_attributes.sofa_seater_count;
          if (
            serviceLower.includes(`${seatCount}`) ||
            serviceLower.includes(`${seatCount}-seater`)
          ) {
            score += 0.2;
            matchReason += " with matching seater count";
          }
        }
      }
    }

    // CARPET CLEANING
    if (
      extractedFacts.service_category === "carpet" ||
      extractedFacts.service_type?.includes("carpet")
    ) {
      if (serviceLower.includes("carpet")) {
        score += 0.8;
        matchReason = "Service name matches carpet cleaning";

        if (extractedFacts.key_attributes.carpet_dimensions) {
          const dims = extractedFacts.key_attributes.carpet_dimensions;
          if (serviceLower.includes(String(dims))) {
            score += 0.2;
            matchReason += ` with ${dims} size match`;
          }
        }
      }
    }

    // PEST CONTROL
    if (
      extractedFacts.service_category === "pest_control" ||
      extractedFacts.service_type?.includes("pest")
    ) {
      if (
        serviceLower.includes("pest") ||
        serviceLower.includes("fumigation") ||
        serviceLower.includes("cockroach")
      ) {
        score += 0.7;
        matchReason = "Service name matches pest control";

        if (extractedFacts.key_attributes.property_bedrooms) {
          const bedrooms = extractedFacts.key_attributes.property_bedrooms;
          if (
            serviceLower.includes(`${bedrooms}`) ||
            serviceLower.includes(`${bedrooms}-bedroom`)
          ) {
            score += 0.3;
            matchReason += ` for ${bedrooms}-bedroom property`;
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        service_id: service.id,
        service_name: service.name,
        confidence: Math.min(bestScore, 1),
        reason: matchReason,
        pricing_type: service.pricing_model,
      };
    }
  }

  if (bestMatch && bestMatch.confidence > 0.5) {
    return bestMatch;
  }

  return null;
}

// Get pricing from existing RPC
async function getPricingForService(
  requestId: string,
  itemId: string
): Promise<PricingResult> {
  try {
    const { data, error } = await supabase.rpc(
      "calculate_booking_engine_item_price",
      {
        p_request_item_id: itemId,
      }
    );

    if (error) {
      console.error("Pricing calculation error:", error);
      return {
        status: "configuration_required",
        message: "Unable to calculate price",
      };
    }

    return {
      status: data.status || "configuration_required",
      price: data.total,
      currency: data.currency || "KES",
      subtotal: data.subtotal,
      discount_amount: data.discount_amount,
      total: data.total,
    };
  } catch (err) {
    console.error("Pricing RPC error:", err);
    return {
      status: "configuration_required",
      message: "Failed to calculate pricing",
    };
  }
}

// Determine photo requirement
interface PhotoRequirement {
  required: boolean;
  reason: string;
}

function determinePhotoRequirement(
  pricingResult: PricingResult,
  matchedService: ServiceMatch | null,
  extractedFacts: ExtractedFacts
): PhotoRequirement {
  if (
    matchedService &&
    matchedService.confidence > 0.7 &&
    pricingResult.status === "priced"
  ) {
    return {
      required: false,
      reason: "straightforward_pricing",
    };
  }

  if (pricingResult.status === "quotation_required") {
    return {
      required: true,
      reason: "quotation_required",
    };
  }

  if (!matchedService || matchedService.confidence < 0.6) {
    return {
      required: true,
      reason: "unmatched_service",
    };
  }

  if (extractedFacts.requires_assessment) {
    return {
      required: true,
      reason: "requires_assessment",
    };
  }

  return {
    required: false,
    reason: "straightforward_pricing",
  };
}

// Create booking engine request
async function createBookingEngineRequest(
  userId: string,
  matchedService: ServiceMatch,
  extractedFacts: ExtractedFacts,
  conversationHistory: DialogueMessage[]
): Promise<{ requestId: string; itemId: string }> {
  try {
    const { data: requestId, error: requestError } = await supabase.rpc(
      "create_booking_engine_request",
      {
        _requested_date: null,
        _requested_time: null,
        _service_location: null,
        _customer_notes: null,
      }
    );

    if (requestError) {
      throw new Error(`Failed to create request: ${requestError.message}`);
    }

    const { data: itemId, error: itemError } = await supabase.rpc(
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

    if (itemError) {
      throw new Error(`Failed to add item: ${itemError.message}`);
    }

    await supabase
      .from("booking_engine_requests")
      .update({
        dialogue_transcript: conversationHistory,
        extracted_facts: extractedFacts,
      })
      .eq("id", requestId);

    return { requestId, itemId };
  } catch (error) {
    console.error("Request creation error:", error);
    throw error;
  }
}

// Main handler
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: BookingAgentRequest = await request.json();

    if (!body.customerMessage) {
      return NextResponse.json(
        { error: "Missing customer message" },
        { status: 400 }
      );
    }

    const extractedFacts = await extractCustomerIntent(
      body.customerMessage,
      body.conversationHistory || []
    );

    const matchedService = await matchServiceDeterministic(extractedFacts);

    let pricingResult: PricingResult = {
      status: "configuration_required",
    };

    if (matchedService) {
      try {
        const { requestId, itemId } = await createBookingEngineRequest(
          body.userId,
          matchedService,
          extractedFacts,
          body.conversationHistory || []
        );

        pricingResult = await getPricingForService(requestId, itemId);
        body.requestId = requestId;
        body.conversationHistory?.push({
          role: "customer",
          message: body.customerMessage,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        pricingResult = {
          status: "quotation_required",
          message: "Service needs assessment",
        };
      }
    }

    const photoRequirement = determinePhotoRequirement(
      pricingResult,
      matchedService,
      extractedFacts
    );

    const agentMessage = await generateAgentResponse(
      body.customerMessage,
      body.conversationHistory || [],
      extractedFacts,
      matchedService,
      pricingResult
    );

    let nextStep: "continue_dialogue" | "collect_photos" | "submit_request" | "error" = "continue_dialogue";
    if (photoRequirement.required) {
      nextStep = "collect_photos";
    }

    const response: BookingAgentResponse = {
      status: "success",
      agentMessage,
      extractedFacts,
      matchedService: matchedService || undefined,
      pricingResult,
      photosRequired: photoRequirement.required,
      photoReason: photoRequirement.reason,
      nextStep,
      requestId: body.requestId,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Booking agent error:", error);
    return NextResponse.json(
      {
        status: "error",
        agentMessage: "Sorry, I had trouble processing that. Can you try again?",
        photosRequired: false,
        nextStep: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
