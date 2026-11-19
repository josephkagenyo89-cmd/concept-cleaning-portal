import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const allowedOrigins = new Set([
  'https://conceptcleaningservices.co.ke',
  'https://www.conceptcleaningservices.co.ke',
  ...(Deno.env.get('SPONSORED_TRACKING_ALLOWED_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean),
]);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const originAllowed = allowedOrigins.has(origin);
  const corsHeaders = {
    'Access-Control-Allow-Origin': originAllowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  if (!originAllowed) return respond({ error: 'Origin not allowed' }, 403);
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id : '';
    const placementId = typeof body.placement_id === 'string' ? body.placement_id : '';
    const eventType = body.event_type;
    const sessionKey = typeof body.session_key === 'string' ? body.session_key : '';
    const sourcePath = typeof body.source_path === 'string' ? body.source_path : '';
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(campaignId) || !uuidPattern.test(placementId) ||
        !uuidPattern.test(sessionKey) || !['impression', 'click'].includes(eventType) ||
        !sourcePath.startsWith('/') || sourcePath.length > 250) {
      return respond({ error: 'Invalid campaign event' }, 400);
    }

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: placement, error: placementError } = await db
      .from('sponsored_campaign_placements')
      .select('id,campaign_id,active')
      .eq('id', placementId).eq('campaign_id', campaignId).eq('active', true).maybeSingle();
    if (placementError || !placement) return respond({ error: 'Placement is not active' }, 404);

    const now = new Date();
    const { data: campaign, error: campaignError } = await db
      .from('sponsored_campaigns')
      .select('id,status,starts_at,ends_at')
      .eq('id', campaignId).eq('status', 'approved').maybeSingle();
    if (campaignError || !campaign) return respond({ error: 'Campaign is not approved' }, 404);
    if ((campaign.starts_at && new Date(campaign.starts_at) > now) ||
        (campaign.ends_at && new Date(campaign.ends_at) <= now)) {
      return respond({ error: 'Campaign is outside its active dates' }, 409);
    }

    const cutoff = new Date(now.getTime() - 30_000).toISOString();
    const { count, error: duplicateError } = await db
      .from('sponsored_campaign_events')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId).eq('placement_id', placementId)
      .eq('event_type', eventType).eq('session_key', sessionKey)
      .gte('occurred_at', cutoff);
    if (duplicateError) throw duplicateError;
    if ((count || 0) > 0) return respond({ accepted: true, deduplicated: true });

    const { error: insertError } = await db.from('sponsored_campaign_events').insert({
      campaign_id: campaignId, placement_id: placementId, event_type: eventType,
      session_key: sessionKey, source_path: sourcePath, occurred_at: now.toISOString(),
    });
    if (insertError) throw insertError;
    return respond({ accepted: true });
  } catch (error) {
    console.error('Sponsored campaign tracking failed:', error);
    return respond({ error: 'Could not record campaign event' }, 500);
  }
});
