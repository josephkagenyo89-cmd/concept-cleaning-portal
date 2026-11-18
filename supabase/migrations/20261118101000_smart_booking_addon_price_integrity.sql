-- Protect server-calculated booking prices from stale input and enforce valid add-on composition.
CREATE OR REPLACE FUNCTION public.booking_engine_invalidate_item_price_on_input_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_config_id IS DISTINCT FROM OLD.service_config_id
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.measurements IS DISTINCT FROM OLD.measurements
     OR NEW.answers IS DISTINCT FROM OLD.answers
     OR NEW.selected_extras IS DISTINCT FROM OLD.selected_extras
     OR NEW.service_config_version IS DISTINCT FROM OLD.service_config_version THEN
    NEW.pricing_snapshot := '{}'::jsonb;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_engine_invalidate_item_price_on_input_change
  ON public.booking_engine_request_items;

CREATE TRIGGER booking_engine_invalidate_item_price_on_input_change
BEFORE UPDATE OF service_id, service_config_id, quantity, measurements, answers, selected_extras, service_config_version
ON public.booking_engine_request_items
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_invalidate_item_price_on_input_change();

REVOKE ALL ON FUNCTION public.booking_engine_invalidate_item_price_on_input_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.booking_engine_prevent_offer_trigger_included_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflicting_relationship text;
BEGIN
  IF NEW.relationship NOT IN ('trigger', 'included') THEN
    RETURN NEW;
  END IF;

  v_conflicting_relationship := CASE
    WHEN NEW.relationship = 'trigger' THEN 'included'
    ELSE 'trigger'
  END;

  IF EXISTS (
    SELECT 1
    FROM public.booking_engine_value_offer_services l
    WHERE l.offer_id = NEW.offer_id
      AND l.service_id = NEW.service_id
      AND l.relationship = v_conflicting_relationship
      AND l.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'A service cannot be both the starting service and an included service in the same package or offer.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_engine_prevent_offer_trigger_included_overlap
  ON public.booking_engine_value_offer_services;

CREATE TRIGGER booking_engine_prevent_offer_trigger_included_overlap
BEFORE INSERT OR UPDATE OF offer_id, service_id, relationship
ON public.booking_engine_value_offer_services
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_prevent_offer_trigger_included_overlap();

REVOKE ALL ON FUNCTION public.booking_engine_prevent_offer_trigger_included_overlap() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.booking_engine_validate_selected_addons_before_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_addon jsonb;
  v_offer public.booking_engine_value_offers%ROWTYPE;
  v_selected_ids text[];
  v_snapshot_ids text[];
  v_current_included jsonb;
  v_inactive_count integer;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    FOR v_item IN
      SELECT id, service_id, selected_extras, pricing_snapshot
      FROM public.booking_engine_request_items
      WHERE request_id = NEW.id
    LOOP
      SELECT COALESCE(array_agg(DISTINCT value #>> '{}' ORDER BY value #>> '{}'), ARRAY[]::text[])
      INTO v_selected_ids
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_item.selected_extras) = 'array'
          THEN v_item.selected_extras ELSE '[]'::jsonb END
      ) AS selected(value)
      WHERE jsonb_typeof(value) = 'string'
        AND value #>> '{}' LIKE 'offer:%';

      SELECT COALESCE(array_agg(DISTINCT 'offer:' || (value->>'id') ORDER BY 'offer:' || (value->>'id')), ARRAY[]::text[])
      INTO v_snapshot_ids
      FROM jsonb_array_elements(COALESCE(v_item.pricing_snapshot->'selected_addons', '[]'::jsonb));

      IF v_selected_ids IS DISTINCT FROM v_snapshot_ids THEN
        RAISE EXCEPTION 'Your optional extras have changed since the estimate was calculated. Calculate your estimate again.';
      END IF;

      FOR v_addon IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_item.pricing_snapshot->'selected_addons', '[]'::jsonb))
      LOOP
        SELECT *
        INTO v_offer
        FROM public.booking_engine_value_offers
        WHERE id = (v_addon->>'id')::uuid
          AND active IS TRUE
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
          AND updated_at IS NOT DISTINCT FROM NULLIF(v_addon->>'offer_updated_at', '')::timestamptz;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'An optional add-on has changed or expired. Review your selections and calculate the estimate again.';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.booking_engine_value_offer_services l
          WHERE l.offer_id = v_offer.id
            AND l.service_id = v_item.service_id
            AND l.relationship = 'trigger'
        ) THEN
          RAISE EXCEPTION 'An optional add-on no longer applies to this service. Refresh your selections.';
        END IF;

        SELECT count(*)
        INTO v_inactive_count
        FROM public.booking_engine_value_offer_services l
        LEFT JOIN public.services s ON s.id = l.service_id
        WHERE l.offer_id = v_offer.id
          AND l.relationship IN ('included', 'recommended')
          AND (s.id IS NULL OR s.is_active IS NOT TRUE);

        IF v_inactive_count > 0 THEN
          RAISE EXCEPTION 'An optional add-on contains a service that is no longer available. Refresh your selections.';
        END IF;

        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'service_id', s.id,
          'service_code', s.service_code,
          'name', s.name,
          'description', s.description,
          'quantity', l.quantity
        ) ORDER BY l.created_at, s.name), '[]'::jsonb)
        INTO v_current_included
        FROM public.booking_engine_value_offer_services l
        JOIN public.services s ON s.id = l.service_id
        WHERE l.offer_id = v_offer.id
          AND l.relationship = 'included';

        IF v_current_included IS DISTINCT FROM COALESCE(v_addon->'included_services', '[]'::jsonb) THEN
          RAISE EXCEPTION 'The included services in an optional add-on have changed. Review your selections and calculate the estimate again.';
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_engine_validate_selected_addons_before_submit() FROM PUBLIC, anon, authenticated;
