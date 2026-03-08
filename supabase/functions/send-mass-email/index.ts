import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  emailId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabase.rpc("is_admin_or_super", { _user_id: user.id });
    if (!isAdmin) throw new Error("Forbidden");

    const { emailId } = (await req.json()) as EmailPayload;

    // Get the mass email record
    const { data: email, error: emailErr } = await supabase
      .from("mass_emails")
      .select("*")
      .eq("id", emailId)
      .single();
    if (emailErr || !email) throw new Error("Email not found");

    // Get SMTP settings from DB
    const { data: smtp, error: smtpErr } = await supabase
      .from("smtp_settings")
      .select("*")
      .limit(1)
      .single();
    if (smtpErr || !smtp) throw new Error("SMTP not configured. Please configure SMTP settings first.");

    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name, from_email, use_tls } = smtp;

    // Mark as sending
    await supabase.from("mass_emails").update({ status: "sending" }).eq("id", emailId);

    // Get recipients based on audience
    let roleFilter: string[];
    if (email.audience_type === "agent") roleFilter = ["agent"];
    else if (email.audience_type === "admin") roleFilter = ["admin", "super_admin"];
    else roleFilter = ["agent", "admin", "super_admin"];

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", roleFilter);

    if (!roleRows || roleRows.length === 0) {
      await supabase.from("mass_emails").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", emailId);
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const uniqueUserIds = [...new Set(roleRows.map((r: any) => r.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", uniqueUserIds);

    const recipients: { id: string; email: string; name: string; role: string }[] = [];
    for (const userId of uniqueUserIds) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
      if (!authUser?.email) continue;
      const profile = profiles?.find((p: any) => p.user_id === userId);
      const role = roleRows.find((r: any) => r.user_id === userId)?.role || "agent";
      recipients.push({ id: userId, email: authUser.email, name: profile?.full_name || "User", role });
    }

    // Create log entries
    const logEntries = recipients.map((r) => ({
      email_id: emailId,
      recipient_id: r.id,
      recipient_email: r.email,
      recipient_role: r.role,
      status: "pending",
    }));
    await supabase.from("mass_email_logs").insert(logEntries);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const port = smtp_port || (use_tls ? 587 : 465);

    let sentCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        let body = email.body
          .replace(/\{\{firstName\}\}/g, recipient.name.split(" ")[0])
          .replace(/\{\{fullName\}\}/g, recipient.name);

        const boundary = "boundary_" + crypto.randomUUID();
        const rawEmail = [
          `From: ${from_name} <${from_email}>`,
          `To: ${recipient.email}`,
          `Subject: ${email.subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          ``,
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          body.replace(/<[^>]*>/g, ""),
          ``,
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;">${body}</body></html>`,
          ``,
          `--${boundary}--`,
        ].join("\r\n");

        const conn = port === 465
          ? await Deno.connectTls({ hostname: smtp_host, port: 465 })
          : await Deno.connect({ hostname: smtp_host, port });

        const read = async (c: Deno.Conn) => {
          const buf = new Uint8Array(1024);
          const n = await c.read(buf);
          return n ? decoder.decode(buf.subarray(0, n)) : "";
        };

        const write = async (c: Deno.Conn, cmd: string) => {
          await c.write(encoder.encode(cmd + "\r\n"));
          return await read(c);
        };

        await read(conn);
        let resp = await write(conn, "EHLO localhost");

        let activeConn: Deno.Conn = conn;

        if (port !== 465 && use_tls && resp.includes("STARTTLS")) {
          await write(conn, "STARTTLS");
          activeConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: smtp_host });
          await write(activeConn, "EHLO localhost");
        }

        const authStr = btoa(`\0${smtp_user}\0${smtp_pass}`);
        await write(activeConn, `AUTH PLAIN ${authStr}`);
        await write(activeConn, `MAIL FROM:<${from_email}>`);
        await write(activeConn, `RCPT TO:<${recipient.email}>`);
        await write(activeConn, "DATA");
        await activeConn.write(encoder.encode(rawEmail + "\r\n.\r\n"));
        await read(activeConn);
        await write(activeConn, "QUIT");
        activeConn.close();

        await supabase.from("mass_email_logs").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("email_id", emailId).eq("recipient_id", recipient.id);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to ${recipient.email}:`, err);
        await supabase.from("mass_email_logs").update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        }).eq("email_id", emailId).eq("recipient_id", recipient.id);
        failCount++;
      }
    }

    await supabase.from("mass_emails").update({
      status: failCount === recipients.length ? "failed" : "sent",
      sent_at: new Date().toISOString(),
    }).eq("id", emailId);

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
