import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    if (Number(req.headers.get('content-length') || '0') > 10000) return new Response(JSON.stringify({ error: 'Request too large' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const body = await req.json();
    const token = typeof body.token === 'string' ? body.token : '';
    const rating = Number(body.rating);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const publicConsent = body.publicDisplayConsent === true;
    if (token.length < 32 || token.length > 256 || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1200) return new Response(JSON.stringify({ error: 'Please provide a valid rating and feedback.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: tokenRow, error: tokenError } = await db.from('signature_tokens').select('booking_id, used, expires_at').eq('token', token).maybeSingle();
    if (tokenError || !tokenRow || !tokenRow.used || new Date(tokenRow.expires_at).getTime() <= Date.now()) return new Response(JSON.stringify({ error: 'This review link is no longer valid. Please contact our team if you need assistance.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: booking, error: bookingError } = await db.from('bookings').select('id, client_id, client_name, agent_id, line_items').eq('id', tokenRow.booking_id).maybeSingle();
    if (bookingError || !booking) throw new Error('Booking not found');
    const { data: existing } = await db.from('customer_feedback').select('id').eq('booking_id', booking.id).eq('source', 'signature').maybeSingle();
    if (existing) return new Response(JSON.stringify({ error: 'Feedback has already been submitted for this booking.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const items = Array.isArray(booking.line_items) ? booking.line_items : [];
    const service = items[0] || {};
    const { error: insertError } = await db.from('customer_feedback').insert({
      booking_id: booking.id, client_id: booking.client_id, client_name: booking.client_name, agent_id: booking.agent_id,
      service_name: service.name || service.service_name || null, rating, comment: comment || null,
      is_complaint: rating <= 2, submitted_by_role: 'customer', source: 'signature',
      public_display_consent: publicConsent, publication_status: publicConsent ? 'pending' : 'private',
    });
    if (insertError) {
      if (insertError.code === '23505') return new Response(JSON.stringify({ error: 'Feedback has already been submitted for this booking.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw insertError;
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Unable to save feedback. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
