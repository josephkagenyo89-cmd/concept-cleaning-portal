import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type ChatMessage = { role: "user" | "assistant"; content: string };
type DateRange = { label: string; start: string; endExclusive: string; timezone: "Africa/Nairobi" };
const ROW_LIMIT = 5000;
const TIMEZONE = "Africa/Nairobi";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const cleanText = (value: unknown, max = 2000) => typeof value === "string" ? value.trim().slice(0, max) : "";

function nairobiToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}
function resolveDateRange(prompt: string): DateRange | null {
  const q = prompt.toLowerCase();
  const today = nairobiToday();
  const [year, month, day] = today.split("-").map(Number);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const previousMonthStart = month === 1 ? `${year - 1}-12-01` : `${year}-${String(month - 1).padStart(2, "0")}-01`;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekStart = addDays(today, -((weekday + 6) % 7));
  const nextWeekStart = addDays(weekStart, 7);
  const explicit = q.match(/(?:from|between)\s+(20\d{2}-\d{2}-\d{2})\s+(?:to|and)\s+(20\d{2}-\d{2}-\d{2})/);
  if (explicit) {
    const [, start, inclusiveEnd] = explicit;
    const validDate = (value: string) => { const parsed = new Date(value + "T00:00:00Z"); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; };
    if (validDate(start) && validDate(inclusiveEnd) && start <= inclusiveEnd) {
      return { label: `${start} to ${inclusiveEnd}`, start, endExclusive: addDays(inclusiveEnd, 1), timezone: TIMEZONE };
    }
  }
  if (/\b(last|past)\s+30\s+days\b/.test(q)) return { label: "Last 30 days", start: addDays(today, -29), endExclusive: addDays(today, 1), timezone: TIMEZONE };
  if (/\b(last|previous)\s+week\b/.test(q)) return { label: "Last week", start: addDays(weekStart, -7), endExclusive: weekStart, timezone: TIMEZONE };
  if (/\b(this|current)\s+week\b/.test(q)) return { label: "This week", start: weekStart, endExclusive: nextWeekStart, timezone: TIMEZONE };
  if (/\b(last|previous)\s+month\b/.test(q)) return { label: "Last month", start: previousMonthStart, endExclusive: monthStart, timezone: TIMEZONE };
  if (/\b(this|current)\s+month\b/.test(q)) return { label: "This month", start: monthStart, endExclusive: nextMonthStart, timezone: TIMEZONE };
  if (/\b(year to date|ytd|this year|current year)\b/.test(q)) {
    return { label: "Year to date", start: `${year}-01-01`, endExclusive: addDays(today, 1), timezone: TIMEZONE };
  }
  return null;
}
function timestampBoundary(date: string): string {
  return new Date(`${date}T00:00:00+03:00`).toISOString();
}
function groupCount(rows: any[], field: string) {
  return rows.reduce((result: Record<string, number>, row) => {
    const key = String(row[field] ?? "Unspecified");
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}
function sum(rows: any[], field: string) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}
function failedSource(error: any) {
  return { available: false, reason: error?.code ? `Database query failed (${String(error.code).slice(0, 24)})` : "Database query failed", count: null, rows: [] as any[] };
}
async function getRows(client: any, table: string, columns: string, limit = ROW_LIMIT) {
  const { data, error, count } = await client.from(table).select(columns, { count: "exact" }).limit(limit);
  if (error) return failedSource(error);
  return { available: true, count: count ?? data?.length ?? 0, truncated: (count ?? 0) > limit, rows: data ?? [] };
}
async function getBookingWindow(client: any, range: DateRange, field: "created_at" | "service_date") {
  let query = client.from("bookings").select("id,status,price,created_at,service_date", { count: "exact" });
  query = field === "created_at"
    ? query.gte(field, timestampBoundary(range.start)).lt(field, timestampBoundary(range.endExclusive))
    : query.gte(field, range.start).lt(field, range.endExclusive);
  const { data, error, count } = await query.limit(ROW_LIMIT);
  if (error) return failedSource(error);
  const rows = data ?? [];
  return {
    available: true, totalRecords: count ?? rows.length, byStatus: groupCount(rows, "status"),
    bookedValue: sum(rows.filter((row: any) => !["cancelled", "rejected"].includes(String(row.status ?? "").toLowerCase())), "price"),
    breakdownComplete: (count ?? rows.length) <= ROW_LIMIT,
  };
}
async function collectBookingContext(client: any, range: DateRange | null) {
  if (range) {
    const [created, scheduled, allTime] = await Promise.all([
      getBookingWindow(client, range, "created_at"),
      getBookingWindow(client, range, "service_date"),
      getRows(client, "bookings", "id,status,price,created_at,service_date"),
    ]);
    return {
      dateRange: range, timezone: TIMEZONE,
      dateDefinitions: {
        created: "bookings.created_at — when the booking record was entered into the ERP",
        scheduled: "bookings.service_date — the date the service is scheduled to take place",
      },
      createdInPeriod: created,
      scheduledInPeriod: scheduled,
      allTime: allTime.available
        ? { totalRecords: allTime.count, byStatus: groupCount(allTime.rows, "status"), breakdownComplete: !allTime.truncated }
        : allTime,
    };
  }
  const bookings = await getRows(client, "bookings", "id,status,price,created_at,service_date");
  if (!bookings.available) return bookings;
  const active = bookings.rows.filter((row: any) => !["cancelled", "rejected"].includes(String(row.status ?? "").toLowerCase()));
  return {
    totalRecords: bookings.count, activeOrCompletedRecords: active.length, bookedValue: sum(active, "price"),
    byStatus: groupCount(bookings.rows, "status"), breakdownComplete: !bookings.truncated,
  };
}
function isGreeting(message: string) {
  return /^(?:hi|hello|hey|good morning|good afternoon|good evening|habari|mambo|sasa)(?:\s+concept ai)?[.!?\s]*$/i.test(message.trim());
}
function isBookingCountQuestion(message: string) {
  return /\b(bookings?|reservations?)\b/i.test(message)
    && /\b(how many|number of|count|total|have we got|do we have|got)\b/i.test(message);
}
function formatStatusLines(statuses: Record<string, number> | undefined) {
  if (!statuses || Object.keys(statuses).length === 0) return "- No booking records found for this period.";
  return Object.entries(statuses).sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `- ${status.replace(/_/g, " ")}: ${count}`).join("\n");
}
function bookingCountAnswer(bookings: any, range: DateRange | null) {
  if (!bookings || bookings.available === false) return "I couldn't retrieve booking records using your current ERP permissions. Please check the bookings access policy or try again.";
  if (!range) {
    return [
      "## Bookings — all-time snapshot",
      `- **Total booking records:** ${bookings.totalRecords}`,
      `- **Active or completed records:** ${bookings.activeOrCompletedRecords}`,
      `- **Booked value (excluding cancelled/rejected):** KES ${Number(bookings.bookedValue || 0).toLocaleString("en-KE")}`,
      "", "**By status**", formatStatusLines(bookings.byStatus),
      bookings.breakdownComplete ? "" : "Status breakdown is based on the first 5,000 records; total record count is exact.",
    ].join("\n");
  }
  const created = bookings.createdInPeriod;
  const scheduled = bookings.scheduledInPeriod;
  if (created?.available === false || scheduled?.available === false) {
    return "I couldn't retrieve the date-filtered booking records. The source query failed, so I won't substitute the all-time total.";
  }
  return [
    `## Bookings — ${range.label}`,
    `- **Created in the ERP during this period:** ${created.totalRecords}`,
    `- **Scheduled to take place during this period:** ${scheduled.totalRecords}`,
    "", "**Status breakdown — bookings created during the period**", formatStatusLines(created.byStatus),
    "", "**Status breakdown — services scheduled during the period**", formatStatusLines(scheduled.byStatus),
    "", `Date basis: ${TIMEZONE}. Created uses \`bookings.created_at\`; scheduled uses \`bookings.service_date\`.`,
    created.breakdownComplete && scheduled.breakdownComplete
      ? "Both period counts and status breakdowns were retrieved within the configured row limit."
      : "Exact period counts are available, but a status breakdown may be incomplete because a source exceeded the 5,000-row retrieval limit.",
  ].join("\n");
}

async function collectBusinessContext(client: any, prompt: string, periodPrompt = prompt) {
  const q = prompt.toLowerCase();
  const all = /\b(all|overall|business|company|management|executive|consolidated|across|every|entire)\b/.test(q);
  const wantsFinance = all || /finance|financial|revenue|income|sales|expense|profit|cash|invoice|payment|ledger|budget|accounts/.test(q);
  const wantsBookings = all || /booking|reservation|job|schedule|service delivery|operations|workload/.test(q);
  const wantsCrm = all || /crm|lead|customer|client|follow.?up|pipeline/.test(q);
  const wantsPest = all || /pest|fumigation|cockroach|bed.?bug|rodent/.test(q);
  const wantsHr = all || /\bhr\b|employee|staff|payroll|workforce/.test(q);
  const wantsServices = all || /service|category|pricing|catalogue|catalog/.test(q);
  const range = resolveDateRange(periodPrompt);
  const context: Record<string, unknown> = {
    scope: "Aggregated operational snapshot only. No customer names, phone numbers, employee names, payroll amounts, bank details, or free-text notes are sent to the model.",
    timezone: TIMEZONE,
    completeness: `Queries are limited to ${ROW_LIMIT} rows per source. Exact counts are returned separately where supported; status breakdowns may be incomplete if a source exceeds the limit.`,
    sources: {},
  };
  const sources = context.sources as Record<string, unknown>;

  if (wantsFinance) {
    const [income, expenses, invoices] = await Promise.all([
      getRows(client, "income_records", "id,amount,date,status"),
      getRows(client, "expenses", "id,amount,date,category,approval_status"),
      getRows(client, "invoices", "id,amount,date,payment_status"),
    ]);
    const approvedIncome = income.rows.filter((row: any) => row.status === "approved");
    const approvedExpenses = expenses.rows.filter((row: any) => row.approval_status === "approved");
    const invoiceRows = invoices.rows.filter((row: any) => !["cancelled", "void", "rejected"].includes(String(row.payment_status ?? "").toLowerCase()));
    sources.finance = {
      approvedIncome: income.available ? { recordCount: approvedIncome.length, totalAmount: sum(approvedIncome, "amount"), truncated: !!income.truncated } : income,
      approvedExpenses: expenses.available ? { recordCount: approvedExpenses.length, totalAmount: sum(approvedExpenses, "amount"), byCategory: groupCount(approvedExpenses, "category"), truncated: !!expenses.truncated } : expenses,
      invoices: invoices.available ? { recordCount: invoiceRows.length, invoicedAmount: sum(invoiceRows, "amount"), byStatus: groupCount(invoiceRows, "payment_status"), truncated: !!invoices.truncated } : invoices,
      note: "Income and expenses include only records marked approved. Invoice value is invoiced value, not cash collected. This legacy summary is not a substitute for the posted double-entry ledger or formal financial statements.",
    };
  }
  if (wantsBookings) sources.bookings = await collectBookingContext(client, range);
  if (wantsCrm) {
    const [leads, clients, tasks] = await Promise.all([
      getRows(client, "leads", "id,status,estimated_value,created_at"),
      getRows(client, "clients", "id,status,total_spend,booking_count"),
      getRows(client, "crm_tasks", "id,status,task_type,due_at"),
    ]);
    sources.crm = {
      leads: leads.available ? { totalRecords: leads.count, estimatedPipelineValue: sum(leads.rows, "estimated_value"), byStatus: groupCount(leads.rows, "status"), truncated: !!leads.truncated } : leads,
      clients: clients.available ? { totalRecords: clients.count, aggregateRecordedSpend: sum(clients.rows, "total_spend"), totalBookingsRecorded: sum(clients.rows, "booking_count"), byStatus: groupCount(clients.rows, "status"), truncated: !!clients.truncated } : clients,
      tasks: tasks.available ? { totalRecords: tasks.count, byStatus: groupCount(tasks.rows, "status"), byType: groupCount(tasks.rows, "task_type"), truncated: !!tasks.truncated } : tasks,
    };
  }
  if (wantsPest) {
    const jobs = await getRows(client, "pest_jobs", "id,status,service_date,created_at");
    sources.pestControl = jobs.available ? { totalRecords: jobs.count, byStatus: groupCount(jobs.rows, "status"), truncated: !!jobs.truncated } : jobs;
  }
  if (wantsHr) {
    const employees = await getRows(client, "employees", "id,employment_status");
    sources.hr = employees.available ? {
      totalEmployeeRecords: employees.count, byEmploymentStatus: groupCount(employees.rows, "employment_status"),
      truncated: !!employees.truncated,
      note: "Counts only. Payroll, compensation, identity details, and employee records are deliberately excluded from AI context.",
    } : employees;
  }
  if (wantsServices) {
    const services = await getRows(client, "services", "id,is_active");
    sources.services = services.available ? {
      totalRecords: services.count, activeRecords: services.rows.filter((row: any) => row.is_active === true).length,
      inactiveRecords: services.rows.filter((row: any) => row.is_active === false).length, truncated: !!services.truncated,
    } : services;
  }
  return context;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in is required." }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  let namedPublishableKey = "";
  if (publishableKeys) {
    try { namedPublishableKey = JSON.parse(publishableKeys).default || ""; } catch { /* use legacy fallback */ }
  }
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || namedPublishableKey;
  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!supabaseUrl || !supabaseKey) return json({ error: "The secure ERP connection is not configured." }, 503);
  if (!groqKey) return json({ error: "Groq is not configured yet. Add GROQ_API_KEY as an Edge Function secret before enabling Concept AI." }, 503);

  try {
    const rawBody = await req.text();
    if (rawBody.length > 24000) return json({ error: "This message is too large. Please shorten it and try again." }, 413);
    const body = JSON.parse(rawBody);
    const message = cleanText(body?.message, 2000);
    if (!message) return json({ error: "Enter a message to continue." }, 400);
    const history: ChatMessage[] = Array.isArray(body?.history)
      ? body.history.slice(-8).map((item: any) => ({
          role: item?.role === "assistant" ? "assistant" : "user", content: cleanText(item?.content, 1500),
        })).filter((item: ChatMessage) => item.content)
      : [];
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const accessToken = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return json({ error: "Your session is invalid or has expired. Sign in again." }, 401);
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (roleError) return json({ error: "Your ERP permissions could not be verified." }, 403);
    const roles = (roleRows ?? []).map((row: any) => row.role);
    if (!roles.some((role: string) => role === "admin" || role === "super_admin")) {
      return json({ error: "Concept AI is available to authorised ERP administrators only." }, 403);
    }
    if (isGreeting(message)) {
      return json({
        answer: "Hello! I'm Concept AI, your reporting and operations assistant for Concept Cleaning Services. What would you like to review?",
        sources: [], limitations: "No ERP data was queried for this greeting.",
        sessionOnly: true, draftOnly: true, model: "greeting-response",
      });
    }
    const contextPrompt = history.filter((item) => item.role === "user").map((item) => item.content).concat(message).join(" ");
    const periodPrompt = resolveDateRange(message) ? message : contextPrompt;
    const businessContext = await collectBusinessContext(supabase, contextPrompt, periodPrompt);
    const sources = (businessContext as any).sources ?? {};
    const bookingCountFollowUp = isBookingCountQuestion(contextPrompt) && !!resolveDateRange(message);
    if ((isBookingCountQuestion(message) || bookingCountFollowUp) && sources.bookings) {
      return json({
        answer: bookingCountAnswer(sources.bookings, resolveDateRange(periodPrompt)),
        sources: ["bookings"], limitations: (businessContext as any).completeness,
        sessionOnly: true, draftOnly: true, model: "erp-deterministic-report",
      });
    }
    const systemPrompt = [
      "You are Concept AI, the reporting and operations assistant for Concept Cleaning Services in Nairobi, Kenya.",
      "Use only the supplied ERP snapshot for factual claims about the business. Never invent figures, records, dates, approvals, or system capabilities.",
      "For date-specific booking questions, use createdInPeriod for bookings entered in the ERP and scheduledInPeriod for services scheduled to take place. Never substitute allTime totals for period totals. State the period, timezone, date field, and any incomplete breakdown.",
      "Booking date ranges are already filtered by the ERP. Do not recalculate, estimate, or broaden them. Exact totalRecords values are authoritative; do not add status counts to derive totals.",
      "Clearly distinguish approved income from invoiced value, booked value, pending approvals, and cash collected. The supplied legacy financial summary is not a posted-ledger statement and must never be described as profit, cash flow, or audited accounts.",
      "If a source is unavailable, say so. If a source is truncated, state that the result may be incomplete. Do not infer missing data.",
      "Data is aggregated and intentionally excludes customer/employee identities, contact details, payroll and compensation amounts, bank details, and free-text notes. Do not ask the user to provide secrets or sensitive personal data.",
      "You may analyse, explain, compare, and recommend. Any proposed change, message, task, booking, quotation, invoice, or accounting adjustment is a DRAFT ONLY. Never claim to have saved, submitted, approved, sent, booked, or changed anything.",
      "All actions require the existing ERP workflow and authorised human approval. Do not suggest bypassing maker-checker controls or approving one's own submission.",
      "Use KES for currency when the source represents Kenyan shillings. Respond using clean Markdown only. Never emit HTML tags such as <br>. Be concise, structured, and practical.",
      "Current ERP data snapshot follows as JSON: " + JSON.stringify(businessContext),
    ].join("\n");
    const configuredModel = Deno.env.get("GROQ_MODEL");
    const model = !configuredModel || configuredModel === "llama-3.3-70b-versatile" ? "openai/gpt-oss-120b" : configuredModel;
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + groqKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
        temperature: 0.2, max_completion_tokens: 1400,
      }),
    });
    if (!groqResponse.ok) {
      const providerError = await groqResponse.text();
      console.error("Groq request failed:", groqResponse.status, providerError.slice(0, 1000));
      return json({ error: "The AI provider could not complete this request. Please try again shortly." }, 502);
    }
    const completion = await groqResponse.json();
    const answer = cleanText(completion?.choices?.[0]?.message?.content, 12000);
    if (!answer) return json({ error: "The AI provider returned an empty response. Please try again." }, 502);
    return json({
      answer, sources: Object.keys(sources), limitations: (businessContext as any).completeness,
      sessionOnly: true, draftOnly: true, model: completion.model || model,
    });
  } catch (error) {
    console.error("Concept AI request failed:", error);
    return json({ error: "Concept AI could not process this request. Please try again." }, 500);
  }
});
