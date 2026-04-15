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

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('signature_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tokenData.used) {
      return new Response(JSON.stringify({ error: 'This signature link has already been used' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This signature link has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save client signature to booking
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        client_signature: signature,
        client_signed_at: new Date().toISOString(),
        client_consent: true,
      })
      .eq('id', tokenData.booking_id);

    if (bookingError) {
      return new Response(JSON.stringify({ error: 'Failed to save signature' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark token as used
    await supabase
      .from('signature_tokens')
      .update({ used: true })
      .eq('id', tokenData.id);

    // Check if staff already signed — if so, mark as fully_confirmed
    const { data: booking } = await supabase
      .from('bookings')
      .select('staff_signature')
      .eq('id', tokenData.booking_id)
      .single();

    if (booking?.staff_signature) {
      await supabase
        .from('bookings')
        .update({ status: 'fully_confirmed' })
        .eq('id', tokenData.booking_id);
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
