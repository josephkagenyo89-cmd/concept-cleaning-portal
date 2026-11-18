-- Keep catalogue publication aligned with Smart Booking administrator approval.
-- A service with a disabled/unapproved guided configuration must not fall back to legacy booking.

CREATE OR REPLACE FUNCTION public.booking_engine_sync_service_catalogue_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.services
  SET is_active = NEW.enabled
  WHERE id = NEW.service_id;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_engine_sync_service_catalogue_active() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_engine_sync_service_catalogue_active
  ON public.booking_engine_service_config;

CREATE TRIGGER booking_engine_sync_service_catalogue_active
AFTER INSERT OR UPDATE OF enabled
ON public.booking_engine_service_config
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_sync_service_catalogue_active();

-- Apply the new publication gate to the already configured sofa service.
UPDATE public.services s
SET is_active = c.enabled
FROM public.booking_engine_service_config c
WHERE c.service_id = s.id
  AND s.name = 'Sofa Cleaning';

CREATE OR REPLACE FUNCTION public.calculate_booking_engine_item_price_base(p_request_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_service RECORD;
  v_config RECORD;
  v_rule RECORD;

  v_rule_count INTEGER := 0;
  v_quantity NUMERIC;
  v_measurement NUMERIC;
  v_unit_key TEXT;
  v_rate NUMERIC;
  v_subtotal NUMERIC;
  v_total NUMERIC;

  v_pricing_type TEXT;
  v_pricing_source TEXT;
  v_snapshot JSONB;
  v_has_conditional_rules BOOLEAN := false;
  v_currency TEXT := 'KES';
BEGIN

  -- Load the request item and its parent request.
  SELECT
    i.*,
    r.customer_user_id,
    r.status AS request_status
  INTO v_item
  FROM public.booking_engine_request_items i
  JOIN public.booking_engine_requests r
    ON r.id = i.request_id
  WHERE i.id = p_request_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request item not found';
  END IF;

  -- Authentication is required.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only staff or the customer who owns the request may price it.
  IF NOT public.is_staff(auth.uid())
     AND v_item.customer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to calculate this request item';
  END IF;

  -- Load the existing service catalogue record.
  SELECT
    s.id,
    s.name,
    sc.name AS category_name,
    s.base_price,
    s.pricing_model,
    s.pricing_unit,
    s.price_per_sqm,
    s.is_active
  INTO v_service
  FROM public.services s
  LEFT JOIN public.service_categories sc ON sc.id = s.category_id
  WHERE s.id = v_item.service_id;

  IF NOT FOUND OR v_service.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Selected service is no longer active';
  END IF;

  -- Load Booking Engine configuration if one exists.
  SELECT *
  INTO v_config
  FROM public.booking_engine_service_config
  WHERE service_id = v_service.id
    AND enabled = true
  LIMIT 1;

  -- ----------------------------------------------------------
  -- Check for applicable active pricing rules.
  -- ----------------------------------------------------------

   -- ----------------------------------------------------------
  -- Check for applicable active pricing rules.
  -- ----------------------------------------------------------

  IF v_config.id IS NOT NULL THEN


    SELECT EXISTS (SELECT 1 FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id AND pr.active IS TRUE
        AND pr.conditions <> '{}'::jsonb) INTO v_has_conditional_rules;

    IF v_has_conditional_rules THEN
      v_quantity := COALESCE(v_item.quantity, 1);
      SELECT COUNT(*) INTO v_rule_count
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id AND pr.active IS TRUE
        AND pr.conditions <> '{}'::jsonb
        AND (NOT (pr.conditions ? 'answers') OR v_item.answers @> pr.conditions->'answers')
        AND (NOT (pr.conditions ? 'measurements') OR v_item.measurements @> pr.conditions->'measurements')
        AND (pr.minimum_quantity IS NULL OR v_quantity >= pr.minimum_quantity)
        AND (pr.maximum_quantity IS NULL OR v_quantity <= pr.maximum_quantity);

      IF v_rule_count = 0 THEN
        RAISE EXCEPTION 'No approved pricing option matches the selected service answers for "%".', v_service.name;
      ELSIF v_rule_count > 1 THEN
        RAISE EXCEPTION 'More than one pricing rule matches the selected service answers for "%". Ask an administrator to correct the pricing setup.', v_service.name;
      END IF;

      SELECT pr.* INTO v_rule
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id AND pr.active IS TRUE
        AND pr.conditions <> '{}'::jsonb
        AND (NOT (pr.conditions ? 'answers') OR v_item.answers @> pr.conditions->'answers')
        AND (NOT (pr.conditions ? 'measurements') OR v_item.measurements @> pr.conditions->'measurements')
        AND (pr.minimum_quantity IS NULL OR v_quantity >= pr.minimum_quantity)
        AND (pr.maximum_quantity IS NULL OR v_quantity <= pr.maximum_quantity)
      LIMIT 1;

      v_pricing_type := v_rule.pricing_type;
      v_rate := v_rule.rate;
      v_currency := COALESCE(v_rule.currency, 'KES');
      v_unit_key := v_rule.unit_key;
      v_pricing_source := 'booking_engine_rule';

      IF v_pricing_type = 'quotation' THEN
        v_snapshot := jsonb_build_object(
          'status', 'quotation_required', 'pricing_type', 'quotation',
          'pricing_source', 'booking_engine_rule', 'service_id', v_service.id,
          'service_name', v_service.name, 'configuration_version', COALESCE(v_config.config_version, 1),
          'rule_id', v_rule.id, 'rule_conditions', v_rule.conditions,
          'selected_answers', v_item.answers, 'currency', v_rule.currency
        );
        UPDATE public.booking_engine_request_items
        SET pricing_snapshot = v_snapshot, updated_at = now()
        WHERE id = p_request_item_id;
        RETURN v_snapshot;
      ELSIF v_pricing_type = 'per_measurement' THEN
        IF v_unit_key IS NULL OR v_unit_key = '' THEN
          RAISE EXCEPTION 'Measurement unit is missing for service "%".', v_service.name;
        END IF;
        v_measurement := NULLIF(v_item.measurements ->> v_unit_key, '')::NUMERIC;
        IF v_measurement IS NULL OR v_measurement <= 0 THEN
          RAISE EXCEPTION 'A valid % measurement is required for service "%".', v_unit_key, v_service.name;
        END IF;
        v_subtotal := v_measurement * v_rate;
      ELSIF v_pricing_type = 'fixed' THEN
        v_subtotal := v_rate;
      ELSIF v_pricing_type IN ('per_unit', 'tiered') THEN
        IF v_quantity IS NULL OR v_quantity <= 0 THEN
          RAISE EXCEPTION 'A valid quantity is required for service "%".', v_service.name;
        END IF;
        v_subtotal := v_quantity * v_rate;
      ELSE
        RAISE EXCEPTION 'Unsupported conditional Booking Engine pricing type "%" for service "%".', v_pricing_type, v_service.name;
      END IF;

    ELSE

    -- A quotation rule is exclusive: it must be the only active rule.
    SELECT COUNT(*)
    INTO v_rule_count
    FROM public.booking_engine_pricing_rules pr
    WHERE pr.service_config_id = v_config.id
      AND pr.active = true
      AND pr.pricing_type = 'quotation';

    IF v_rule_count > 0 THEN

      IF (
        SELECT COUNT(*)
        FROM public.booking_engine_pricing_rules pr
        WHERE pr.service_config_id = v_config.id
          AND pr.active = true
      ) > 1 THEN
        RAISE EXCEPTION
          'Quotation pricing rule must be the only active pricing rule for service "%".',
          v_service.name;
      END IF;

      SELECT pr.*
      INTO v_rule
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'quotation'
      LIMIT 1;

      v_snapshot := jsonb_build_object(
        'status', 'quotation_required',
        'pricing_type', 'quotation',
        'pricing_source', 'booking_engine_rule',
        'service_id', v_service.id,
        'service_name', v_service.name,
        'configuration_version',
          COALESCE(v_config.config_version, 1),
        'rule_id', v_rule.id,
        'currency', v_rule.currency
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = p_request_item_id;

      RETURN v_snapshot;
    END IF;

    -- Tiered pricing may have multiple active rules.
    IF EXISTS (
      SELECT 1
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'tiered'
    ) THEN

      -- Tiered pricing requires a quantity.
      v_quantity := v_item.quantity;

      IF v_quantity IS NULL OR v_quantity <= 0 THEN
        RAISE EXCEPTION
          'A valid quantity is required for tiered pricing of service "%".',
          v_service.name;
      END IF;

      SELECT COUNT(*)
      INTO v_rule_count
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'tiered'
        AND v_quantity >= COALESCE(pr.minimum_quantity, 0)
        AND (
          pr.maximum_quantity IS NULL
          OR v_quantity <= pr.maximum_quantity
        );

      IF v_rule_count = 0 THEN
        RAISE EXCEPTION
          'No pricing tier matches quantity % for service "%".',
          v_quantity,
          v_service.name;
      END IF;

      IF v_rule_count > 1 THEN
        RAISE EXCEPTION
          'Multiple pricing tiers match quantity % for service "%".',
          v_quantity,
          v_service.name;
      END IF;

      SELECT pr.*
      INTO v_rule
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'tiered'
        AND v_quantity >= COALESCE(pr.minimum_quantity, 0)
        AND (
          pr.maximum_quantity IS NULL
          OR v_quantity <= pr.maximum_quantity
        )
      LIMIT 1;

      v_pricing_type := 'tiered';
      v_rate := v_rule.rate;
      v_unit_key := v_rule.unit_key;
      v_pricing_source := 'booking_engine_rule';
      v_subtotal := v_quantity * v_rate;

    ELSE

      -- Non-tiered pricing must have exactly one active rule.
      SELECT COUNT(*)
      INTO v_rule_count
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true;

      IF v_rule_count > 1 THEN
        RAISE EXCEPTION
          'Multiple active pricing rules are configured for service "%".',
          v_service.name;
      END IF;

      IF v_rule_count = 1 THEN

        SELECT pr.*
        INTO v_rule
        FROM public.booking_engine_pricing_rules pr
        WHERE pr.service_config_id = v_config.id
          AND pr.active = true
        LIMIT 1;

        v_pricing_type := v_rule.pricing_type;
        v_rate := v_rule.rate;
        v_currency := COALESCE(v_rule.currency, 'KES');
        v_unit_key := v_rule.unit_key;
        v_pricing_source := 'booking_engine_rule';

        -- Measurement-based pricing.
        IF v_pricing_type = 'per_measurement' THEN

          IF v_unit_key IS NULL OR v_unit_key = '' THEN
            RAISE EXCEPTION
              'Measurement unit is missing for service "%".',
              v_service.name;
          END IF;

          v_measurement :=
            NULLIF(v_item.measurements ->> v_unit_key, '')::NUMERIC;

          IF v_measurement IS NULL OR v_measurement <= 0 THEN
            RAISE EXCEPTION
              'A valid % measurement is required for service "%".',
              v_unit_key,
              v_service.name;
          END IF;

          v_subtotal := v_measurement * v_rate;

        ELSE

          -- Quantity-based pricing.
          v_quantity := COALESCE(v_item.quantity, 1);

          IF v_quantity <= 0 THEN
            RAISE EXCEPTION
              'A valid quantity is required for service "%".',
              v_service.name;
          END IF;
          IF v_rule.minimum_quantity IS NOT NULL AND v_quantity < v_rule.minimum_quantity THEN
            RAISE EXCEPTION 'Quantity is below the configured minimum for service "%".', v_service.name;
          END IF;
          IF v_rule.maximum_quantity IS NOT NULL AND v_quantity > v_rule.maximum_quantity THEN
            RAISE EXCEPTION 'Quantity exceeds the configured maximum for service "%".', v_service.name;
          END IF;

          IF v_pricing_type = 'fixed' THEN
            v_subtotal := v_rate;

          ELSIF v_pricing_type = 'per_unit' THEN
            v_subtotal := v_quantity * v_rate;

          ELSE
            RAISE EXCEPTION
              'Unsupported Booking Engine pricing type "%" for service "%".',
              v_pricing_type,
              v_service.name;
          END IF;

        END IF;

      END IF;

    END IF;
    END IF;

  ELSE
    -- No Booking Engine configuration exists.
    -- Existing catalogue remains the fallback.

    IF v_service.base_price IS NULL
       OR v_service.base_price <= 0 THEN

      v_snapshot := jsonb_build_object(
        'status', 'quotation_required',
        'pricing_type', 'quotation',
        'pricing_source', 'service_catalogue',
        'service_id', v_service.id,
        'service_name', v_service.name,
        'base_price', v_service.base_price,
        'currency', 'KES'
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = p_request_item_id;

      RETURN v_snapshot;
    END IF;

    IF v_service.pricing_model = 'fixed' THEN

      v_pricing_type := 'fixed';
      v_pricing_source := 'service_catalogue';
      v_subtotal := v_service.base_price;

    ELSIF v_service.pricing_model = 'per_unit' THEN

      v_pricing_type := 'per_unit';
      v_pricing_source := 'service_catalogue';
      v_quantity := COALESCE(v_item.quantity, 1);
      v_subtotal := v_service.base_price * v_quantity;

    ELSE

      v_snapshot := jsonb_build_object(
        'status', 'configuration_required',
        'pricing_type', 'variation',
        'pricing_source', 'service_catalogue',
        'service_id', v_service.id,
        'service_name', v_service.name,
        'base_price', v_service.base_price,
        'currency', 'KES'
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = p_request_item_id;

      RETURN v_snapshot;

    END IF;

  END IF;

  v_total := ROUND(v_subtotal, 2);

  v_snapshot := jsonb_build_object(
    'status', 'priced',
    'pricing_type', v_pricing_type,
    'pricing_source', v_pricing_source,
    'service_id', v_service.id,
    'service_name', v_service.name,
    'service_category', v_service.category_name,
    'base_price', v_service.base_price,
    'quantity', v_quantity,
    'measurement_unit', v_unit_key,
    'measurement_value', v_measurement,
    'rate', v_rate,
    'selected_answers', v_item.answers,
    'selected_measurements', v_item.measurements,
    'subtotal', v_subtotal,
    'discount_amount', 0,
    'total', v_total,
    'currency', COALESCE(v_currency, 'KES'),
    'configuration_version',
      COALESCE(v_config.config_version, 1),
    'calculated_at', now()
  );

  UPDATE public.booking_engine_request_items
  SET pricing_snapshot = v_snapshot,
      updated_at = now()
  WHERE id = p_request_item_id;

  RETURN v_snapshot;
END;
$function$
;
