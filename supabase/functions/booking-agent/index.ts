import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DialogueMessage {
  role: "customer" | "agent";
  message: string;
  timestamp: string;
}

interface BookingAgentRequest {
  customerMessage: string;
  conversationHistory?: DialogueMessage[];
  userId: string;
}

serve(async (req: Request) => {
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

    console.log("Message:", body.customerMessage);

    // Get Groq API key
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY not configured");
    }

    // Build messages array
    const messages: any[] = body.conversationHistory?.map((msg) => ({
      role: msg.role === "agent" ? "assistant" : "user",
      content: msg.message,
    })) || [];

    messages.push({
      role: "user",
      content: body.customerMessage,
    });

    // Call Groq API
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        max_tokens: 200,
        messages: messages,
        system: "You are a friendly booking assistant for Concept Cleaning Services in Nairobi. Answer helpfully in 1-3 sentences.",
      }),
    });

    if (!groqResponse.ok) {
      const error = await groqResponse.text();
      console.error("Groq API error:", groqResponse.status, error);
      throw new Error(`Groq API failed: ${groqResponse.status}`);
    }

    const result = await groqResponse.json();
    const agentMessage = result.choices?.[0]?.message?.content || "How can I help you?";

    return new Response(
      JSON.stringify({
        status: "success",
        agentMessage: agentMessage,
        nextStep: "continue_dialogue",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        agentMessage: "Sorry, I'm having trouble right now. Please try again in a moment.",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
