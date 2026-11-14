import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await db.from('customer_feedback')
      .select('id, client_name, rating, comment, service_name')
      .eq('source', 'signature').eq('public_display_consent', true).eq('publication_status', 'approved')
      .eq('is_complaint', false).not('comment', 'is', null).neq('comment', '')
      .order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(6);
    if (error) throw error;
    const reviews = (data || []).map(r => ({ id: r.id, display_name: (r.client_name || 'Customer').trim().split(/\s+/)[0], rating: r.rating, comment: r.comment, service_name: r.service_name }));
    return new Response(JSON.stringify({ reviews }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
  } catch {
    return new Response(JSON.stringify({ reviews: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
