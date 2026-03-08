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

    // Get unique user IDs and their emails from auth (via profiles + auth)
    const uniqueUserIds = [...new Set(roleRows.map((r: any) => r.user_id))];

    // Get profiles for names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", uniqueUserIds);

    // Get emails from auth.users via admin API
    const recipients: { id: string; email: string; name: string; role: string }[] = [];
    for (const userId of uniqueUserIds) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
      if (!authUser?.email) continue;
      const profile = profiles?.find((p: any) => p.user_id === userId);
      const role = roleRows.find((r: any) => r.user_id === userId)?.role || "agent";
      recipients.push({
        id: userId,
        email: authUser.email,
        name: profile?.full_name || "User",
        role,
      });
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

    // SMTP config
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT") || "587";
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") || smtpUser;
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Concept Cleaning Services";

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured");
    }

    let sentCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        // Replace placeholders
        let body = email.body
          .replace(/\{\{firstName\}\}/g, recipient.name.split(" ")[0])
          .replace(/\{\{fullName\}\}/g, recipient.name);

        // Build raw email
        const boundary = "boundary_" + crypto.randomUUID();
        const rawEmail = [
          `From: ${fromName} <${fromEmail}>`,
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

        // Send via SMTP using Deno's built-in TCP
        const conn = parseInt(smtpPort) === 465
          ? await Deno.connectTls({ hostname: smtpHost, port: 465 })
          : await Deno.connect({ hostname: smtpHost, port: parseInt(smtpPort) });

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const read = async () => {
          const buf = new Uint8Array(1024);
          const n = await conn.read(buf);
          return n ? decoder.decode(buf.subarray(0, n)) : "";
        };

        const write = async (cmd: string) => {
          await conn.write(encoder.encode(cmd + "\r\n"));
          return await read();
        };

        await read(); // greeting
        let resp = await write(`EHLO localhost`);

        // STARTTLS if not already TLS
        if (parseInt(smtpPort) !== 465 && resp.includes("STARTTLS")) {
          await write("STARTTLS");
          const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: smtpHost });
          // Re-assign read/write for TLS
          const tlsRead = async () => {
            const buf = new Uint8Array(1024);
            const n = await tlsConn.read(buf);
            return n ? decoder.decode(buf.subarray(0, n)) : "";
          };
          const tlsWrite = async (cmd: string) => {
            await tlsConn.write(encoder.encode(cmd + "\r\n"));
            return await tlsRead();
          };
          await tlsWrite("EHLO localhost");
          const authStr = btoa(`\0${smtpUser}\0${smtpPass}`);
          await tlsWrite(`AUTH PLAIN ${authStr}`);
          await tlsWrite(`MAIL FROM:<${fromEmail}>`);
          await tlsWrite(`RCPT TO:<${recipient.email}>`);
          await tlsWrite("DATA");
          await tlsConn.write(encoder.encode(rawEmail + "\r\n.\r\n"));
          await tlsRead();
          await tlsWrite("QUIT");
          tlsConn.close();
        } else {
          const authStr = btoa(`\0${smtpUser}\0${smtpPass}`);
          await write(`AUTH PLAIN ${authStr}`);
          await write(`MAIL FROM:<${fromEmail}>`);
          await write(`RCPT TO:<${recipient.email}>`);
          await write("DATA");
          await conn.write(encoder.encode(rawEmail + "\r\n.\r\n"));
          await read();
          await write("QUIT");
          conn.close();
        }

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

    // Update mass email status
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
