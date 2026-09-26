import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Groq from "https://esm.sh/groq-sdk@0.9.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const groq = new Groq({ apiKey: Deno.env.get("GROQ_API_KEY") });

interface DialogueMessage {
  role: "customer" | "agent";
  message: string;
  timestamp: string;
}

interface BookingAgentRequest {
  customerMessage: string;
  conversationHistory?: DialogueMessage[];
  userId: string;
  requestId?: string;
}

async function generateAgentResponse(
  customerMessage: string,
  conversationHistory: DialogueMessage[] = []
): Promise<string> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = conversationHistory.map((msg) => ({
    role: msg.role === "agent" ? "assistant" : "user",
    content: msg.message,
  }));

  messages.push({
    role: "user",
    content: customerMessage,
  });

  const systemPrompt = `You are a friendly booking assistant for Concept Cleaning Services in Nairobi.
Ask clarifying questions progressively. Keep responses to 1-3 sentences. Use casual, friendly tone.`;

  try {
    const response = await groq.chat.completions.create({
      model: "mixtral-8x7b-32768",
      max_tokens: 200,
      system: systemPrompt,
      messages: messages,
    });

    return response.choices[0].message.content || "Tell me more about what you need.";
  } catch (error) {
    console.error("Groq error:", error);
    return "Let me help you. Can you describe what you need?";
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BookingAgentRequest = await req.json();

    if (!body.customerMessage) {
      return new Response(
        JSON.stringify({ error: "Missing customerMessage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Message:", body.customerMessage, "User:", body.userId);

    const agentMessage = await generateAgentResponse(
      body.customerMessage,
      body.conversationHistory
    );

    return new Response(
      JSON.stringify({
        status: "success",
        agentMessage,
        nextStep: "continue_dialogue",
        requestId: body.requestId || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        agentMessage: "I had trouble with that. Please try again.",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
