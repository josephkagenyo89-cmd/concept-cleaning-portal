import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, signature, clientName } = await req.json();

    if (!token || !signature || !clientName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof signature !== 'string' || !signature.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'Invalid signature format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Basic abuse protection: reject oversized request bodies before parsing the signature.
    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength > 2500000) {
      return new Response(JSON.stringify({ error: 'Request too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atomically validate and consume the bearer token, then apply the signature.
    // This prevents concurrent requests from using the same token twice.
    const { error: applyError } = await supabase.rpc('apply_client_signature', {
      p_token: token,
      p_signature: signature,
      p_client_name: clientName,
    });

    if (applyError) {
      const message = applyError.message || '';
      const isClientError =
        message.includes('Invalid signature token') ||
        message.includes('Invalid signature format') ||
        message.includes('Invalid client name') ||
        message.includes('Invalid, expired, or already used signature link');

      return new Response(JSON.stringify({
        error: isClientError ? message : 'Failed to save signature',
      }), {
        status: isClientError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
