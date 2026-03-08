import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const { to } = await req.json();
    if (!to) throw new Error("Missing 'to' email address");

    // Get SMTP settings from DB
    const { data: smtp, error: smtpErr } = await supabase
      .from("smtp_settings")
      .select("*")
      .limit(1)
      .single();
    if (smtpErr || !smtp) throw new Error("SMTP not configured. Save settings first.");

    const { smtp_host, smtp_port, smtp_user, smtp_pass, from_name, from_email, use_tls } = smtp;

    const rawEmail = [
      `From: ${from_name} <${from_email}>`,
      `To: ${to}`,
      `Subject: SMTP Test - Concept Cleaning Services`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      `<html><body style="font-family:Arial,sans-serif;padding:20px;">`,
      `<h2>✅ SMTP Test Successful</h2>`,
      `<p>Your email configuration is working correctly.</p>`,
      `<p style="color:#888;font-size:12px;">Sent from Concept Cleaning Services Admin</p>`,
      `</body></html>`,
    ].join("\r\n");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const port = smtp_port || (use_tls ? 587 : 465);
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

    await read(conn); // greeting
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
    await write(activeConn, `RCPT TO:<${to}>`);
    await write(activeConn, "DATA");
    await activeConn.write(encoder.encode(rawEmail + "\r\n.\r\n"));
    await read(activeConn);
    await write(activeConn, "QUIT");
    activeConn.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Test SMTP error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
