CREATE OR REPLACE FUNCTION public.get_public_sponsored_placements(
  p_placement_key text,
  p_category_name text DEFAULT NULL
)
RETURNS TABLE (
  placement_id uuid, campaign_id uuid, placement_key text, category_id uuid,
  service_id uuid, display_label text, display_order integer, title text,
  description text, destination_url text, creative_image_url text,
  starts_at timestamptz, ends_at timestamptz, currency text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT p.id, p.campaign_id, p.placement_key, p.category_id, p.service_id,
    p.display_label, p.display_order, c.title, c.description, c.destination_url,
    c.creative_image_url, c.starts_at, c.ends_at, c.currency
  FROM public.sponsored_campaign_placements p
  JOIN public.sponsored_campaigns c ON c.id = p.campaign_id
  LEFT JOIN public.service_categories sc ON sc.id = p.category_id
  WHERE p.active = true AND p.placement_key = p_placement_key
    AND p_placement_key IN ('homepage_featured','marketplace_featured','category_featured','search_featured')
    AND ((p_placement_key = 'category_featured' AND p_category_name IS NOT NULL AND sc.name = p_category_name)
      OR (p_placement_key <> 'category_featured' AND p_category_name IS NULL))
    AND c.status = 'approved'
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.ends_at IS NULL OR c.ends_at > now())
  ORDER BY p.display_order ASC, p.created_at ASC
  LIMIT 8;
$function$;
REVOKE ALL ON FUNCTION public.get_public_sponsored_placements(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_sponsored_placements(text, text) TO anon, authenticated;
