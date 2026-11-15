import { supabase } from "@/integrations/supabase/client";

export interface ConceptAIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConceptAIResponse {
  answer: string;
  sources: string[];
  limitations?: string;
  sessionOnly: true;
  draftOnly: true;
  model?: string;
}

export async function askConceptAI(
  message: string,
  history: ConceptAIMessage[] = [],
): Promise<ConceptAIResponse> {
  const { data, error } = await supabase.functions.invoke("concept-ai", {
    body: { message, history: history.slice(-8) },
  });

  if (error) {
    const details = typeof data?.error === "string" ? data.error : error.message;
    throw new Error(details || "Could not reach Concept AI.");
  }
  if (data?.error) throw new Error(String(data.error));
  if (typeof data?.answer !== "string" || !data.answer.trim()) {
    throw new Error("Concept AI returned an invalid response.");
  }
  return data as ConceptAIResponse;
}
