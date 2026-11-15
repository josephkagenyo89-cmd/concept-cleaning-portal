import { FormEvent, useMemo, useState } from "react";
import { Bot, Download, Loader2, MessageSquare, Plus, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { askConceptAI, type ConceptAIMessage } from "@/lib/conceptAI";
import { downloadConceptAIReport } from "@/lib/aiReportPdf";

const suggestions = [
  "Prepare a consolidated management overview of the business.",
  "Analyse approved income, approved expenses and invoice values. Explain the limitations.",
  "Summarise bookings and operational workload.",
  "Review the CRM pipeline and outstanding follow-up tasks.",
  "Summarise pest-control activity and service delivery.",
  "Prepare a draft action plan to improve business performance.",
];

export default function ConceptAI() {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<ConceptAIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const latestAnswer = useMemo(
    () => [...messages].reverse().find((item) => item.role === "assistant"),
    [messages],
  );

  const send = async (value?: string) => {
    const prompt = (value ?? input).trim();
    if (!prompt || loading || !isAdmin) return;
    const prior = messages.slice(-8);
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const result = await askConceptAI(prompt, prior);
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Concept AI could not complete the request.");
      setMessages((current) => current.filter((item, index) => !(index === current.length - 1 && item.role === "user" && item.content === prompt)));
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const exportReport = async () => {
    if (!latestAnswer || exporting) return;
    setExporting(true);
    try {
      await downloadConceptAIReport("Concept AI Report", latestAnswer.content, []);
    } catch {
      setError("The PDF could not be generated. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const clearSession = () => {
    if (loading) return;
    setMessages([]);
    setInput("");
    setError("");
  };

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">You do not have permission to use Concept AI.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
            <Badge variant="secondary">Groq-powered assistant</Badge>
            <Badge variant="outline">Session only</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Concept AI</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Ask questions across authorised ERP areas, prepare management analysis, and develop draft action plans.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {latestAnswer && <Button variant="outline" size="sm" onClick={exportReport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download PDF
          </Button>}
          <Button variant="outline" size="sm" onClick={clearSession} disabled={loading || messages.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" />Clear session
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0">
          <CardContent className="flex min-h-[560px] flex-col p-0">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Concept AI Assistant</p>
                <p className="text-xs text-muted-foreground">ERP-grounded analysis · Human approval required</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="h-7 w-7" /></div>
                  <h2 className="text-lg font-semibold">What would you like to understand?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Ask about performance, finance, bookings, CRM, services, pest control, or authorised HR summaries.</p>
                  <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                    {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)}
                      className="rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50">
                      <span className="font-medium">{suggestion}</span>
                    </button>)}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={message.role === "user" ? "ml-auto max-w-[90%]" : "mr-auto max-w-[96%]"}>
                  <div className={message.role === "user"
                    ? "rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : "rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-3 text-sm"}>
                    <div className="mb-1 text-[11px] font-semibold opacity-70">{message.role === "user" ? "You" : "Concept AI"}</div>
                    <div className="whitespace-pre-wrap break-words leading-6">{message.content}</div>
                  </div>
                </div>
              ))}
              {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analysing authorised ERP data…</div>}
            </div>

            {error && <div className="px-4 pb-2"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>}
            <form onSubmit={submit} className="border-t p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <Textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={2000}
                  placeholder="Ask Concept AI about your business…" className="max-h-36 min-h-[48px] resize-y" disabled={loading} />
                <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={loading || !input.trim()} aria-label="Send message">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Messages stay in this browser session only. Refreshing or starting a new session clears the conversation.</p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Security and approvals</div>
              <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
                <li>• Access is checked again by the secure backend.</li>
                <li>• ERP reads use your signed-in permissions and existing row-level security.</li>
                <li>• Customer and employee identities, payroll amounts and bank details are excluded from AI context.</li>
                <li>• AI suggestions are drafts only. Existing ERP approval workflows remain mandatory.</li>
                <li>• Conversation history is not saved to the database.</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4 text-primary" />PDF reports</div>
              <p className="text-xs leading-5 text-muted-foreground">Download an individual answer or ask for a consolidated management overview, then export the latest response as a branded PDF.</p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => void send("Prepare a consolidated management overview across all available authorised ERP modules. Clearly label unavailable or incomplete sources.")} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />Prepare management overview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
