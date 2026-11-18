-- Allow customers to select multiple priced add-ons/upgrades alongside one package.
-- Add-on selections reuse the existing selected_extras JSON array with an "offer:<uuid>" key.
-- Existing scope-extra IDs and existing package snapshots remain compatible.

DO $$
BEGIN
  IF to_regprocedure('public.calculate_booking_engine_item_price_addons_base(uuid)') IS NULL THEN
    ALTER FUNCTION public.calculate_booking_engine_item_price(uuid)
      RENAME TO calculate_booking_engine_item_price_addons_base;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.calculate_booking_engine_item_price(p_request_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base jsonb;
  v_result jsonb;
  v_item public.booking_engine_request_items%ROWTYPE;
  v_selected text;
  v_offer public.booking_engine_value_offers%ROWTYPE;
  v_included jsonb;
  v_addons jsonb := '[]'::jsonb;
  v_final_addons jsonb := '[]'::jsonb;
  v_addon jsonb;
  v_status text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_discount numeric := 0;
  v_amount numeric := 0;
  v_discount_amount numeric := 0;
  v_addons_amount numeric := 0;
  v_addons_discount numeric := 0;
  v_bad_links integer := 0;
  v_has_quotation_addon boolean := false;
BEGIN
  v_base := public.calculate_booking_engine_item_price_addons_base(p_request_item_id);

  SELECT *
  INTO v_item
  FROM public.booking_engine_request_items
  WHERE id = p_request_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request item not found.';
  END IF;

  FOR v_selected IN
    SELECT DISTINCT value #>> '{}'
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(v_item.selected_extras) = 'array' THEN v_item.selected_extras
        ELSE '[]'::jsonb
      END
    ) AS selected(value)
    WHERE jsonb_typeof(value) = 'string'
      AND value #>> '{}' LIKE 'offer:%'
  LOOP
    IF substring(v_selected FROM 7) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'An optional add-on selection is invalid. Refresh the booking form and try again.';
    END IF;

    SELECT *
    INTO v_offer
    FROM public.booking_engine_value_offers
    WHERE id = substring(v_selected FROM 7)::uuid
      AND active IS TRUE
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'An optional add-on is no longer available. Refresh your selections and try again.';
    END IF;

    IF v_offer.offer_type NOT IN ('add_on', 'upgrade') THEN
      RAISE EXCEPTION 'Only add-ons and upgrades can be selected as optional extras.';
    END IF;

    IF v_offer.price_mode NOT IN ('fixed', 'fixed_discount', 'percentage_discount', 'quotation') THEN
      RAISE EXCEPTION 'An optional add-on has an unsupported pricing method.';
    END IF;

    IF v_offer.price_mode <> 'quotation'
       AND (v_offer.price_value IS NULL OR v_offer.price_value < 0) THEN
      RAISE EXCEPTION 'An optional add-on has an invalid configured price.';
    END IF;

    IF v_offer.price_mode = 'percentage_discount' AND v_offer.price_value > 100 THEN
      RAISE EXCEPTION 'An optional add-on discount cannot exceed 100 percent.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.booking_engine_value_offer_services l
      WHERE l.offer_id = v_offer.id
        AND l.service_id = v_item.service_id
        AND l.relationship = 'trigger'
    ) THEN
      RAISE EXCEPTION 'An optional add-on does not apply to the selected service.';
    END IF;

    SELECT count(*)
    INTO v_bad_links
    FROM public.booking_engine_value_offer_services l
    LEFT JOIN public.services s ON s.id = l.service_id
    WHERE l.offer_id = v_offer.id
      AND l.relationship IN ('included', 'recommended')
      AND (s.id IS NULL OR s.is_active IS NOT TRUE);

    IF v_bad_links > 0 THEN
      RAISE EXCEPTION 'An optional add-on contains an inactive service. Ask our team to update it.';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'service_id', s.id,
      'service_code', s.service_code,
      'name', s.name,
      'description', s.description,
      'quantity', l.quantity
    ) ORDER BY l.created_at, s.name), '[]'::jsonb)
    INTO v_included
    FROM public.booking_engine_value_offer_services l
    JOIN public.services s ON s.id = l.service_id
    WHERE l.offer_id = v_offer.id
      AND l.relationship = 'included';

    v_addons := v_addons || jsonb_build_array(jsonb_build_object(
      'id', v_offer.id,
      'offer_key', v_offer.offer_key,
      'title', v_offer.title,
      'description', v_offer.description,
      'terms', v_offer.terms,
      'offer_type', v_offer.offer_type,
      'price_mode', v_offer.price_mode,
      'price_value', v_offer.price_value,
      'currency', v_offer.currency,
      'offer_updated_at', v_offer.updated_at,
      'selected_at', now(),
      'trigger_service_id', v_item.service_id,
      'included_services', v_included
    ));

    IF v_offer.price_mode = 'quotation' THEN
      v_has_quotation_addon := true;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_addons) = 0 THEN
    RETURN v_base;
  END IF;

  v_status := COALESCE(v_base->>'status', '');
  v_subtotal := COALESCE(NULLIF(v_base->>'subtotal', '')::numeric, NULLIF(v_base->>'total', '')::numeric, 0);
  v_total := COALESCE(NULLIF(v_base->>'total', '')::numeric, v_subtotal);
  v_discount := COALESCE(NULLIF(v_base->>'discount_amount', '')::numeric, 0);

  FOR v_addon IN SELECT value FROM jsonb_array_elements(v_addons)
  LOOP
    v_amount := COALESCE(NULLIF(v_addon->>'price_value', '')::numeric, 0);
    v_discount_amount := 0;

    IF v_status = 'priced' AND NOT v_has_quotation_addon THEN
      IF v_addon->>'price_mode' = 'fixed' THEN
        v_subtotal := v_subtotal + v_amount;
        v_total := v_total + v_amount;
        v_addons_amount := v_addons_amount + v_amount;
      ELSIF v_addon->>'price_mode' = 'fixed_discount' THEN
        v_discount_amount := LEAST(v_total, v_amount);
        v_total := GREATEST(v_total - v_discount_amount, 0);
        v_discount := v_discount + v_discount_amount;
        v_addons_discount := v_addons_discount + v_discount_amount;
      ELSIF v_addon->>'price_mode' = 'percentage_discount' THEN
        v_discount_amount := ROUND(v_total * LEAST(GREATEST(v_amount, 0), 100) / 100, 2);
        v_total := GREATEST(v_total - v_discount_amount, 0);
        v_discount := v_discount + v_discount_amount;
        v_addons_discount := v_addons_discount + v_discount_amount;
      END IF;
      v_addon := v_addon || jsonb_build_object('calculated_amount', v_discount_amount, 'priced', true);
    ELSE
      v_addon := v_addon || jsonb_build_object('calculated_amount', NULL, 'priced', false);
    END IF;

    v_final_addons := v_final_addons || jsonb_build_array(v_addon);
  END LOOP;

  IF v_status = 'priced' AND NOT v_has_quotation_addon THEN
    v_result := v_base || jsonb_build_object(
      'selected_addons', v_final_addons,
      'addons_amount', v_addons_amount,
      'addons_discount_amount', v_addons_discount,
      'subtotal', v_subtotal,
      'discount_amount', v_discount,
      'total', v_total
    );
  ELSE
    v_result := v_base || jsonb_build_object(
      'status', 'quotation_required',
      'selected_addons', v_final_addons,
      'addons_pending_quote', true
    );
  END IF;

  UPDATE public.booking_engine_request_items
  SET pricing_snapshot = v_result,
      updated_at = now()
  WHERE id = p_request_item_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_booking_engine_item_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_booking_engine_item_price(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.calculate_booking_engine_item_price_addons_base(uuid) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.booking_engine_expand_offer_line_items_addons_base(uuid)') IS NULL THEN
    ALTER FUNCTION public.booking_engine_expand_offer_line_items(uuid)
      RENAME TO booking_engine_expand_offer_line_items_addons_base;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.booking_engine_expand_offer_line_items(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lines jsonb;
  v_item record;
  v_addon jsonb;
  v_component jsonb;
  v_line_idx integer;
  v_cursor integer := 0;
  v_line_count integer;
  v_main jsonb;
  v_main_total numeric;
  v_main_discount numeric;
  v_amount numeric;
  v_mode text;
BEGIN
  v_lines := public.booking_engine_expand_offer_line_items_addons_base(_request_id);

  FOR v_item IN
    SELECT id, service_id, pricing_snapshot
    FROM public.booking_engine_request_items
    WHERE request_id = _request_id
    ORDER BY display_order, created_at
  LOOP
    v_line_count := COALESCE(jsonb_array_length(v_lines), 0);
    v_line_idx := v_cursor;

    WHILE v_line_idx < v_line_count LOOP
      IF v_lines->v_line_idx->>'id' = v_item.service_id::text
         AND COALESCE(v_lines->v_line_idx->>'line_type', '') NOT IN ('included_in_package', 'included_in_addon', 'booking_engine_addon', 'booking_engine_offer_discount', 'booking_engine_addon_quoted') THEN
        EXIT;
      END IF;
      v_line_idx := v_line_idx + 1;
    END LOOP;

    IF v_line_idx >= v_line_count THEN
      CONTINUE;
    END IF;

    v_main := v_lines->v_line_idx;
    v_cursor := v_line_idx + 1;

    FOR v_addon IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_item.pricing_snapshot->'selected_addons', '[]'::jsonb))
    LOOP
      v_mode := v_addon->>'price_mode';
      v_amount := COALESCE(NULLIF(v_addon->>'calculated_amount', '')::numeric, 0);

      IF v_mode = 'fixed' THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'id', v_addon->>'id',
          'code', 'ADDON-' || COALESCE(v_addon->>'offer_key', 'OPTION'),
          'name', v_addon->>'title',
          'description', v_addon->>'description',
          'price', v_amount,
          'quantity', 1,
          'discount', 0,
          'total', v_amount,
          'line_type', 'booking_engine_addon',
          'offer_id', v_addon->>'id'
        ));
      ELSIF v_mode IN ('fixed_discount', 'percentage_discount') THEN
        v_main_total := COALESCE(NULLIF(v_main->>'total', '')::numeric, 0);
        v_main_discount := COALESCE(NULLIF(v_main->>'discount', '')::numeric, 0);
        v_main := jsonb_set(v_main, '{discount}', to_jsonb(v_main_discount + v_amount), true);
        v_main := jsonb_set(v_main, '{total}', to_jsonb(GREATEST(v_main_total - v_amount, 0)), true);
        v_lines := jsonb_set(v_lines, ARRAY[v_line_idx::text], v_main, true);
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'id', v_addon->>'id',
          'code', 'DISCOUNT-' || COALESCE(v_addon->>'offer_key', 'OPTION'),
          'name', COALESCE(v_addon->>'title', 'Optional saving'),
          'description', 'Discount applied to this booking',
          'price', 0,
          'quantity', 1,
          'discount', v_amount,
          'total', 0,
          'line_type', 'booking_engine_offer_discount',
          'offer_id', v_addon->>'id'
        ));
      ELSE
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'id', v_addon->>'id',
          'code', 'ADDON-' || COALESCE(v_addon->>'offer_key', 'OPTION'),
          'name', v_addon->>'title',
          'description', COALESCE(v_addon->>'description', 'Included in staff quotation'),
          'price', 0,
          'quantity', 1,
          'discount', 0,
          'total', 0,
          'line_type', 'booking_engine_addon_quoted',
          'offer_id', v_addon->>'id'
        ));
      END IF;

      FOR v_component IN
        SELECT value FROM jsonb_array_elements(COALESCE(v_addon->'included_services', '[]'::jsonb))
      LOOP
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'id', v_component->>'service_id',
          'code', v_component->>'service_code',
          'name', v_component->>'name',
          'description', v_component->>'description',
          'price', 0,
          'quantity', COALESCE(NULLIF(v_component->>'quantity', '')::numeric, 1),
          'discount', 0,
          'total', 0,
          'line_type', 'included_in_addon',
          'included_in_addon', true,
          'offer_id', v_addon->>'id',
          'addon_title', v_addon->>'title'
        ));
      END LOOP;
    END LOOP;

    WHILE v_cursor < v_line_count AND v_lines->v_cursor->>'line_type' = 'included_in_package' LOOP
      v_cursor := v_cursor + 1;
    END LOOP;
  END LOOP;

  RETURN v_lines;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_engine_expand_offer_line_items(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.booking_engine_expand_offer_line_items_addons_base(uuid) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.prepare_booking_engine_quotation_addons_base(uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.prepare_booking_engine_quotation(uuid, jsonb)
      RENAME TO prepare_booking_engine_quotation_addons_base;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prepare_booking_engine_quotation(
  _request_id uuid,
  _quoted_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_quotation_id uuid;
  v_item record;
  v_addon jsonb;
  v_addons jsonb;
  v_final_addons jsonb;
  v_mode text;
  v_amount numeric;
  v_discount_amount numeric;
  v_subtotal numeric;
  v_total numeric;
  v_discount numeric;
  v_addons_amount numeric;
  v_addons_discount numeric;
BEGIN
  v_result := public.prepare_booking_engine_quotation_addons_base(_request_id, _quoted_items);
  v_quotation_id := NULLIF(v_result->>'quotation_id', '')::uuid;

  IF v_quotation_id IS NULL THEN
    RETURN v_result;
  END IF;

  FOR v_item IN
    SELECT id, pricing_snapshot
    FROM public.booking_engine_request_items
    WHERE request_id = _request_id
      AND jsonb_typeof(pricing_snapshot->'selected_addons') = 'array'
  LOOP
    v_addons := COALESCE(v_item.pricing_snapshot->'selected_addons', '[]'::jsonb);
    v_final_addons := '[]'::jsonb;
    v_subtotal := COALESCE(NULLIF(v_item.pricing_snapshot->>'subtotal', '')::numeric, NULLIF(v_item.pricing_snapshot->>'total', '')::numeric, 0);
    v_total := COALESCE(NULLIF(v_item.pricing_snapshot->>'total', '')::numeric, v_subtotal);
    v_discount := COALESCE(NULLIF(v_item.pricing_snapshot->>'discount_amount', '')::numeric, 0);
    v_addons_amount := 0;
    v_addons_discount := 0;

    FOR v_addon IN SELECT value FROM jsonb_array_elements(v_addons)
    LOOP
      v_mode := v_addon->>'price_mode';
      v_amount := COALESCE(NULLIF(v_addon->>'price_value', '')::numeric, 0);
      v_discount_amount := 0;

      IF v_mode = 'fixed' THEN
        v_subtotal := v_subtotal + v_amount;
        v_total := v_total + v_amount;
        v_addons_amount := v_addons_amount + v_amount;
        v_discount_amount := v_amount;
      ELSIF v_mode = 'fixed_discount' THEN
        v_discount_amount := LEAST(v_total, v_amount);
        v_total := GREATEST(v_total - v_discount_amount, 0);
        v_discount := v_discount + v_discount_amount;
        v_addons_discount := v_addons_discount + v_discount_amount;
      ELSIF v_mode = 'percentage_discount' THEN
        v_discount_amount := ROUND(v_total * LEAST(GREATEST(v_amount, 0), 100) / 100, 2);
        v_total := GREATEST(v_total - v_discount_amount, 0);
        v_discount := v_discount + v_discount_amount;
        v_addons_discount := v_addons_discount + v_discount_amount;
      END IF;

      v_addon := v_addon || jsonb_build_object('calculated_amount', v_discount_amount, 'priced', true);
      v_final_addons := v_final_addons || jsonb_build_array(v_addon);
    END LOOP;

    UPDATE public.booking_engine_request_items
    SET pricing_snapshot = pricing_snapshot || jsonb_build_object(
      'status', 'priced',
      'selected_addons', v_final_addons,
      'addons_amount', v_addons_amount,
      'addons_discount_amount', v_addons_discount,
      'subtotal', v_subtotal,
      'discount_amount', v_discount,
      'total', v_total,
      'addons_pending_quote', false
    ),
    updated_at = now()
    WHERE id = v_item.id;
  END LOOP;

  SELECT
    COALESCE(SUM(COALESCE(NULLIF(pricing_snapshot->>'subtotal', '')::numeric, 0)), 0),
    COALESCE(SUM(COALESCE(NULLIF(pricing_snapshot->>'discount_amount', '')::numeric, 0)), 0),
    COALESCE(SUM(COALESCE(NULLIF(pricing_snapshot->>'total', '')::numeric, 0)), 0)
  INTO v_subtotal, v_discount, v_total
  FROM public.booking_engine_request_items
  WHERE request_id = _request_id;

  UPDATE public.quotations
  SET line_items = public.booking_engine_expand_offer_line_items(_request_id),
      subtotal = v_subtotal,
      discount_amount = v_discount,
      price = v_total,
      updated_at = now()
  WHERE id = v_quotation_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_booking_engine_quotation(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_booking_engine_quotation(uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.prepare_booking_engine_quotation_addons_base(uuid, jsonb) FROM PUBLIC, anon, authenticated;

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
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    FOR v_item IN
      SELECT id, service_id, pricing_snapshot
      FROM public.booking_engine_request_items
      WHERE request_id = NEW.id
    LOOP
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
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_engine_validate_selected_addons_before_submit
  ON public.booking_engine_requests;

CREATE TRIGGER booking_engine_validate_selected_addons_before_submit
BEFORE UPDATE OF status ON public.booking_engine_requests
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_validate_selected_addons_before_submit();

REVOKE ALL ON FUNCTION public.booking_engine_validate_selected_addons_before_submit() FROM PUBLIC, anon, authenticated;
