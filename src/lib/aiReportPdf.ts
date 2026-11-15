import { downloadAccountingPdf } from "@/lib/accountingPdf";

export async function downloadConceptAIReport(title: string, content: string, sources: string[] = []) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map((line) => [line.length > 500 ? line.slice(0, 497) + "..." : line]);
  if (sources.length) rows.push(["Data areas consulted: " + sources.join(", ")]);
  rows.push(["AI-generated analysis. Verify important figures against the relevant ERP source module before making business decisions."]);
  await downloadAccountingPdf({
    title,
    period: "Snapshot at time of request",
    columns: ["Report content"],
    rows,
    filters: ["Prepared by Concept AI", "Session-only conversation", "Draft analysis — not an approval or accounting record"],
  });
}
