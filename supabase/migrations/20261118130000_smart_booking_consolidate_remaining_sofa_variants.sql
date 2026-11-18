-- Consolidate remaining legacy sofa variants into the approved configurable Sofa Cleaning service.
-- Original catalogue rows remain intact for historical booking references.

DO $sofa_aliases$
DECLARE
  v_primary_service_id UUID;
BEGIN
  SELECT id INTO v_primary_service_id
  FROM public.services
  WHERE name = 'Sofa Cleaning'
  LIMIT 1;

  IF v_primary_service_id IS NULL THEN
    RAISE EXCEPTION 'Canonical Sofa Cleaning service not found; no aliases were changed.';
  END IF;

  INSERT INTO public.booking_engine_service_aliases
    (alias_service_id, primary_service_id, match_confidence, notes)
  SELECT s.id, v_primary_service_id, 1.0,
         'Legacy sofa size/type catalogue entry consolidated into configurable Sofa Cleaning; historical bookings remain linked to this original service.'
  FROM public.services s
  WHERE s.service_code IN ('1SS','2SS','3SS','5SS','6SS','7SS','LSS','RS','SS')
    AND s.id <> v_primary_service_id
  ON CONFLICT (alias_service_id, primary_service_id) DO UPDATE
    SET match_confidence = EXCLUDED.match_confidence,
        notes = EXCLUDED.notes,
        updated_at = now();

  UPDATE public.services
  SET is_active = false
  WHERE service_code IN ('1SS','2SS','3SS','5SS','6SS','7SS','LSS','RS','SS')
    AND id <> v_primary_service_id
    AND is_active IS TRUE;
END
$sofa_aliases$;
