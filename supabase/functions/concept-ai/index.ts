import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function getRows(client: any, table: string, columns: string, limit = 5000) {
  const { data, error, count } = await client.from(table).select(columns, { count: "exact" }).limit(limit);
  if (error) return { available: false, reason: "Access denied or source unavailable", count: null, rows: [] as any[] };
  return {
    available: true,
    count: count ?? data?.length ?? 0,
    truncated: (count ?? 0) > limit,
    rows: data ?? [],
  };
}

function sum(rows: any[], field: string) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function groupCount(rows: any[], field: string) {
  return rows.reduce((result: Record<string, number>, row) => {
    const key = String(row[field] ?? "Unspecified");
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

async function collectBusinessContext(client: any, prompt: string) {
  const q = prompt.toLowerCase();
  const all = /\b(all|overall|business|company|management|executive|consolidated|across|every|entire)\b/.test(q);
  const wantsFinance = all || /finance|financial|revenue|income|sales|expense|profit|cash|invoice|payment|ledger|budget|accounts/.test(q);
  const wantsBookings = all || /booking|job|schedule|service delivery|operations|workload/.test(q);
  const wantsCrm = all || /crm|lead|customer|client|follow.?up|pipeline/.test(q);
  const wantsPest = all || /pest|fumigation|cockroach|bed.?bug|rodent/.test(q);
  const wantsHr = all || /\bhr\b|employee|staff|payroll|workforce/.test(q);
  const wantsServices = all || /service|category|pricing|catalogue|catalog/.test(q);

  const context: Record<string, unknown> = {
    scope: "Aggregated operational snapshot only. No customer names, phone numbers, employee names, payroll amounts, bank details, or free-text notes are sent to the model.",
    completeness: "Queries are limited to 5,000 rows per source. If a source is unavailable or truncated, this is stated rather than treated as a complete result.",
    sources: {},
  };
  const sources = context.sources as Record<string, unknown>;

  if (wantsFinance) {
    const [income, expenses, invoices] = await Promise.all([
      getRows(client, "income_records", "id,amount,date,status"),
      getRows(client, "expenses", "id,amount,date,category,approval_status"),
      getRows(client, "invoices", "id,amount,date,payment_status"),
    ]);
    const approvedIncome = income.rows.filter((r) => r.status === "approved");
    const approvedExpenses = expenses.rows.filter((r) => r.approval_status === "approved");
    const invoiceRows = invoices.rows.filter((r) => !["cancelled", "void", "rejected"].includes(String(r.payment_status ?? "").toLowerCase()));
    sources.finance = {
      approvedIncome: income.available ? { recordCount: approvedIncome.length, totalAmount: sum(approvedIncome, "amount") } : income,
      approvedExpenses: expenses.available ? { recordCount: approvedExpenses.length, totalAmount: sum(approvedExpenses, "amount"), byCategory: groupCount(approvedExpenses, "category") } : expenses,
      invoices: invoices.available ? {
        recordCount: invoiceRows.length,
        invoicedAmount: sum(invoiceRows, "amount"),
        byStatus: groupCount(invoiceRows, "payment_status"),
      } : invoices,
      note: "Income and expenses include only records marked approved. Invoice value is invoiced value, not cash collected. This legacy summary is not a substitute for the posted double-entry ledger or formal financial statements.",
      completeness: [income, expenses, invoices].some((r) => r.truncated) ? "One or more sources exceeded the 5,000-row retrieval limit." : "Within configured retrieval limit.",
    };
  }

  if (wantsBookings) {
    const bookings = await getRows(client, "bookings", "id,status,price,created_at");
    const active = bookings.rows.filter((r) => !["cancelled", "rejected"].includes(String(r.status ?? "").toLowerCase()));
    sources.bookings = bookings.available ? {
      totalRecords: bookings.count,
      activeOrCompletedRecords: active.length,
      bookedValue: sum(active, "price"),
      byStatus: groupCount(bookings.rows, "status"),
      truncated: !!bookings.truncated,
    } : bookings;
  }

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
    const jobs = await getRows(client, "pest_jobs", "id,status,created_at");
    sources.pestControl = jobs.available
      ? { totalRecords: jobs.count, byStatus: groupCount(jobs.rows, "status"), truncated: !!jobs.truncated }
      : jobs;
  }

  if (wantsHr) {
    const employees = await getRows(client, "employees", "id");
    sources.hr = employees.available
      ? { employeeRecords: employees.count, note: "Employee count only. Payroll, compensation, identity details, and employee records are deliberately excluded from AI context." }
      : employees;
  }

  if (wantsServices) {
    const services = await getRows(client, "services", "id,is_active");
    sources.services = services.available
      ? { totalRecords: services.count, activeRecords: services.rows.filter((r) => r.is_active === true).length, inactiveRecords: services.rows.filter((r) => r.is_active === false).length, truncated: !!services.truncated }
      : services;
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
          role: item?.role === "assistant" ? "assistant" : "user",
          content: cleanText(item?.content, 1500),
        })).filter((item: ChatMessage) => item.content)
      : [];

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const accessToken = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return json({ error: "Your session is invalid or has expired. Sign in again." }, 401);

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (roleError) return json({ error: "Your ERP permissions could not be verified." }, 403);
    const roles = (roleRows ?? []).map((row: any) => row.role);
    if (!roles.some((role: string) => role === "admin" || role === "super_admin")) {
      return json({ error: "Concept AI is available to authorised ERP administrators only." }, 403);
    }

    const contextPrompt = history.filter((item) => item.role === "user").map((item) => item.content).concat(message).join(" ");
    const businessContext = await collectBusinessContext(supabase, contextPrompt);
    const systemPrompt = [
      "You are Concept AI, the reporting and operations assistant for Concept Cleaning Services in Nairobi, Kenya.",
      "Use only the supplied ERP snapshot for factual claims about the business. Never invent figures, records, dates, approvals, or system capabilities.",
      "Clearly distinguish approved income from invoiced value, booked value, pending approvals, and cash collected. The supplied legacy financial summary is not a posted-ledger statement and must never be described as profit, cash flow, or audited accounts.",
      "If a source is unavailable, say so. If a source is truncated, state that the result may be incomplete. Do not infer missing data.",
      "Data is aggregated and intentionally excludes customer/employee identities, contact details, payroll and compensation amounts, bank details, and free-text notes. Do not ask the user to provide secrets or sensitive personal data.",
      "You may analyse, explain, compare, and recommend. Any proposed change, message, task, booking, quotation, invoice, or accounting adjustment is a DRAFT ONLY. Never claim to have saved, submitted, approved, sent, booked, or changed anything.",
      "All actions require the existing ERP workflow and authorised human approval. Do not suggest bypassing maker-checker controls or approving one's own submission.",
      "Use KES for currency when the source represents Kenyan shillings. Be concise, structured, and practical. Explain the source and limitations of each key metric.",
      "Current ERP data snapshot follows as JSON: " + JSON.stringify(businessContext),
    ].join("\n");

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + groqKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: message },
        ],
        temperature: 0.2,
        max_completion_tokens: 1400,
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
      answer,
      sources: Object.keys((businessContext as any).sources ?? {}),
      limitations: (businessContext as any).completeness,
      sessionOnly: true,
      draftOnly: true,
      model: completion.model || Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile",
    });
  } catch (error) {
    console.error("Concept AI request failed:", error);
    return json({ error: "Concept AI could not process this request. Please try again." }, 500);
  }
});
