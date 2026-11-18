-- Smart Booking: persist one accepted package/offer per request, price it on the server,
-- and carry the accepted composition into the existing quotation and ERP booking line items.

CREATE TABLE IF NOT EXISTS public.booking_engine_request_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.booking_engine_requests(id) ON DELETE CASCADE,
  request_item_id uuid NOT NULL UNIQUE REFERENCES public.booking_engine_request_items(id) ON DELETE CASCADE,
  offer_id uuid NULL REFERENCES public.booking_engine_value_offers(id) ON DELETE SET NULL,
  offer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(offer_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_engine_request_offers_request_idx
  ON public.booking_engine_request_offers(request_id);

ALTER TABLE public.booking_engine_request_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_engine_admin_manage_request_offers ON public.booking_engine_request_offers;
CREATE POLICY booking_engine_admin_manage_request_offers
  ON public.booking_engine_request_offers
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS booking_engine_customers_read_own_request_offers ON public.booking_engine_request_offers;
CREATE POLICY booking_engine_customers_read_own_request_offers
  ON public.booking_engine_request_offers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.booking_engine_requests r
      WHERE r.id = booking_engine_request_offers.request_id
        AND r.customer_user_id = auth.uid()
        AND public.owns_client(r.customer_id, auth.uid())
    )
  );

REVOKE ALL ON public.booking_engine_request_offers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_engine_request_offers TO authenticated;

ALTER TABLE public.booking_engine_value_offers
  DROP CONSTRAINT IF EXISTS booking_engine_value_offers_percentage_max;
ALTER TABLE public.booking_engine_value_offers
  ADD CONSTRAINT booking_engine_value_offers_percentage_max
  CHECK (price_mode <> 'percentage_discount' OR price_value <= 100);

CREATE OR REPLACE FUNCTION public.set_booking_engine_request_offer(
  _request_id uuid,
  _request_item_id uuid,
  _offer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_item public.booking_engine_request_items%ROWTYPE;
  v_offer public.booking_engine_value_offers%ROWTYPE;
  v_included jsonb := '[]'::jsonb;
  v_recommended jsonb := '[]'::jsonb;
  v_bad_links integer := 0;
  v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found.';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Offers can only be changed while the request is a draft.';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'You are not authorized to change this request offer.';
  END IF;

  IF v_request.customer_user_id = auth.uid()
     AND NOT public.owns_client(v_request.customer_id, auth.uid()) THEN
    RAISE EXCEPTION 'Customer ownership could not be verified.';
  END IF;

  SELECT * INTO v_item
  FROM public.booking_engine_request_items
  WHERE id = _request_item_id
    AND request_id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected service item does not belong to this request.';
  END IF;

  IF _offer_id IS NULL THEN
    DELETE FROM public.booking_engine_request_offers
    WHERE request_id = _request_id;

    UPDATE public.booking_engine_request_items
    SET pricing_snapshot = '{}'::jsonb, updated_at = now()
    WHERE id = _request_item_id;

    RETURN jsonb_build_object('status', 'cleared', 'request_id', _request_id);
  END IF;

  SELECT * INTO v_offer
  FROM public.booking_engine_value_offers
  WHERE id = _offer_id
    AND active IS TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This offer is no longer active. Refresh the offers and choose again.';
  END IF;

  IF v_offer.offer_type = 'recurring' THEN
    RAISE EXCEPTION 'Recurring offers are not yet supported in one-time guided booking.';
  END IF;

  IF v_offer.offer_type = 'package'
     AND v_offer.price_mode NOT IN ('fixed', 'quotation') THEN
    RAISE EXCEPTION 'Packages must use a fixed bundle price or staff quotation. Use an add-on or upgrade for discounts.';
  END IF;

  IF v_offer.price_mode = 'percentage_discount'
     AND (v_offer.price_value IS NULL OR v_offer.price_value < 0 OR v_offer.price_value > 100) THEN
    RAISE EXCEPTION 'The configured percentage discount must be between 0 and 100.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.booking_engine_value_offer_services l
    WHERE l.offer_id = v_offer.id
      AND l.service_id = v_item.service_id
      AND l.relationship = 'trigger'
  ) THEN
    RAISE EXCEPTION 'This offer does not apply to the selected service.';
  END IF;

  SELECT count(*) INTO v_bad_links
  FROM public.booking_engine_value_offer_services l
  LEFT JOIN public.services s ON s.id = l.service_id
  WHERE l.offer_id = v_offer.id
    AND l.relationship IN ('included', 'recommended')
    AND (s.id IS NULL OR s.is_active IS NOT TRUE);

  IF v_bad_links > 0 THEN
    RAISE EXCEPTION 'This offer contains an inactive or unavailable service. Ask an administrator to update it.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.booking_engine_value_offer_services l
    WHERE l.offer_id = v_offer.id
      AND l.relationship = 'included'
      AND l.service_id = v_item.service_id
  ) THEN
    RAISE EXCEPTION 'The selected main service cannot also be listed as an included service.';
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'service_id', s.id,
    'service_code', s.service_code,
    'name', s.name,
    'description', s.description,
    'quantity', l.quantity
  ) ORDER BY l.created_at, s.name), '[]'::jsonb)
  INTO v_recommended
  FROM public.booking_engine_value_offer_services l
  JOIN public.services s ON s.id = l.service_id
  WHERE l.offer_id = v_offer.id
    AND l.relationship = 'recommended';

  IF v_offer.offer_type = 'package' AND jsonb_array_length(v_included) = 0 THEN
    RAISE EXCEPTION 'A package must include at least one active service.';
  END IF;

  v_snapshot := jsonb_build_object(
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
    'included_services', v_included,
    'recommended_services', v_recommended
  );

  INSERT INTO public.booking_engine_request_offers (
    request_id, request_item_id, offer_id, offer_snapshot, updated_at
  )
  VALUES (_request_id, _request_item_id, v_offer.id, v_snapshot, now())
  ON CONFLICT (request_id) DO UPDATE
  SET request_item_id = EXCLUDED.request_item_id,
      offer_id = EXCLUDED.offer_id,
      offer_snapshot = EXCLUDED.offer_snapshot,
      updated_at = now();

  UPDATE public.booking_engine_request_items
  SET pricing_snapshot = '{}'::jsonb, updated_at = now()
  WHERE id = _request_item_id;

  RETURN jsonb_build_object('status', 'selected', 'request_id', _request_id, 'offer', v_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION public.set_booking_engine_request_offer(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booking_engine_request_offer(uuid, uuid, uuid) TO authenticated;

-- The existing calculation function remains the authoritative service-pricing engine.
-- Rename it and wrap it so offer adjustments are applied to its trusted result.
DO $$
BEGIN
  IF to_regprocedure('public.calculate_booking_engine_item_price_base(uuid)') IS NULL THEN
    ALTER FUNCTION public.calculate_booking_engine_item_price(uuid)
      RENAME TO calculate_booking_engine_item_price_base;
  END IF;
END;
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
  v_offer jsonb;
  v_mode text;
  v_type text;
  v_base_total numeric := 0;
  v_base_subtotal numeric := 0;
  v_offer_amount numeric := 0;
  v_discount numeric := 0;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_rate numeric := 0;
BEGIN
  v_base := public.calculate_booking_engine_item_price_base(p_request_item_id);

  SELECT ro.offer_snapshot
  INTO v_offer
  FROM public.booking_engine_request_offers ro
  WHERE ro.request_item_id = p_request_item_id;

  IF NOT FOUND THEN
    RETURN v_base;
  END IF;

  v_mode := v_offer->>'price_mode';
  v_type := v_offer->>'offer_type';
  v_offer_amount := COALESCE(NULLIF(v_offer->>'price_value', '')::numeric, 0);

  IF COALESCE(v_base->>'status', '') = 'configuration_required' THEN
    RETURN v_base || jsonb_build_object('offer', v_offer);
  END IF;

  IF v_mode = 'quotation' THEN
    v_result := v_base || jsonb_build_object(
      'status', 'quotation_required',
      'pricing_type', 'quotation',
      'offer', v_offer,
      'offer_id', v_offer->>'id',
      'offer_type', v_type,
      'offer_price_mode', v_mode,
      'offer_amount', NULL,
      'included_services', COALESCE(v_offer->'included_services', '[]'::jsonb)
    );
  ELSE
    v_base_total := COALESCE(NULLIF(v_base->>'total', '')::numeric,
                             NULLIF(v_base->>'subtotal', '')::numeric, 0);
    v_base_subtotal := COALESCE(NULLIF(v_base->>'subtotal', '')::numeric, v_base_total);
    v_rate := COALESCE(NULLIF(v_base->>'rate', '')::numeric, v_base_total);

    IF COALESCE(v_base->>'status', '') = 'quotation_required'
       AND NOT (v_type = 'package' AND v_mode = 'fixed') THEN
      v_result := v_base || jsonb_build_object(
        'offer', v_offer,
        'offer_id', v_offer->>'id',
        'offer_type', v_type,
        'offer_price_mode', v_mode,
        'offer_amount', v_offer_amount,
        'included_services', COALESCE(v_offer->'included_services', '[]'::jsonb)
      );
    ELSE
      IF v_type = 'package' AND v_mode = 'fixed' THEN
        -- A fixed package price is the complete bundle price, even if the
        -- standalone trigger service normally requires a staff quotation.
        v_subtotal := v_offer_amount;
        v_discount := 0;
        v_total := v_offer_amount;
        v_rate := v_offer_amount;
      ELSIF v_mode = 'fixed' THEN
        -- Fixed add-on / upgrade amount is added to the normal service total.
        v_subtotal := v_base_subtotal + v_offer_amount;
        v_discount := 0;
        v_total := v_base_total + v_offer_amount;
      ELSIF v_mode = 'fixed_discount' THEN
        v_subtotal := v_base_subtotal;
        v_discount := LEAST(v_subtotal, v_offer_amount);
        v_total := GREATEST(v_base_total - v_discount, 0);
      ELSIF v_mode = 'percentage_discount' THEN
        v_subtotal := v_base_subtotal;
        v_discount := ROUND(v_subtotal * LEAST(GREATEST(v_offer_amount, 0), 100) / 100, 2);
        v_total := GREATEST(v_base_total - v_discount, 0);
      ELSE
        RAISE EXCEPTION 'Unsupported Booking Engine offer price mode: %', v_mode;
      END IF;

      v_result := v_base || jsonb_build_object(
        'status', 'priced',
        'pricing_type', CASE WHEN v_type = 'package' THEN 'package' ELSE v_base->>'pricing_type' END,
        'offer', v_offer,
        'offer_id', v_offer->>'id',
        'offer_type', v_type,
        'offer_price_mode', v_mode,
        'offer_amount', v_offer_amount,
        'base_total', v_base_total,
        'offer_discount', v_discount,
        'included_services', COALESCE(v_offer->'included_services', '[]'::jsonb),
        'subtotal', v_subtotal,
        'discount_amount', v_discount,
        'total', v_total,
        'rate', v_rate
      );
    END IF;
  END IF;

  UPDATE public.booking_engine_request_items
  SET pricing_snapshot = v_result, updated_at = now()
  WHERE id = p_request_item_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_booking_engine_item_price(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_booking_engine_item_price(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.calculate_booking_engine_item_price_base(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_booking_engine_item_price_base(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_engine_expand_offer_line_items(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lines jsonb := '[]'::jsonb;
  v_item record;
  v_snapshot jsonb;
  v_offer jsonb;
  v_offer_type text;
  v_mode text;
  v_total numeric;
  v_base_total numeric;
  v_offer_amount numeric;
  v_discount numeric;
  v_rate numeric;
  v_quantity numeric;
  v_included jsonb;
  v_component jsonb;
BEGIN
  FOR v_item IN
    SELECT ri.*, s.service_code, s.name AS service_name, s.description AS service_description
    FROM public.booking_engine_request_items ri
    JOIN public.services s ON s.id = ri.service_id
    WHERE ri.request_id = _request_id
    ORDER BY ri.display_order, ri.created_at
  LOOP
    v_snapshot := COALESCE(v_item.pricing_snapshot, '{}'::jsonb);
    v_offer := v_snapshot->'offer';
    v_total := COALESCE(NULLIF(v_snapshot->>'total', '')::numeric, 0);
    v_base_total := COALESCE(NULLIF(v_snapshot->>'base_total', '')::numeric,
                             NULLIF(v_snapshot->>'subtotal', '')::numeric, v_total);
    v_offer_amount := COALESCE(NULLIF(v_snapshot->>'offer_amount', '')::numeric, 0);
    v_discount := COALESCE(NULLIF(v_snapshot->>'discount_amount', '')::numeric, 0);
    v_rate := COALESCE(NULLIF(v_snapshot->>'rate', '')::numeric, 0);
    v_quantity := COALESCE(v_item.quantity, 1);

    IF v_offer IS NULL THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'id', v_item.service_id,
        'code', v_item.service_code,
        'name', v_item.service_name,
        'description', v_item.service_description,
        'price', v_rate,
        'quantity', v_quantity,
        'discount', v_discount,
        'total', v_total
      ));
      CONTINUE;
    END IF;

    v_offer_type := v_offer->>'offer_type';
    v_mode := COALESCE(v_snapshot->>'offer_price_mode', v_offer->>'price_mode');

    IF v_offer_type = 'package' THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'id', v_item.service_id,
        'code', v_offer->>'offer_key',
        'name', v_offer->>'title',
        'description', v_offer->>'description',
        'price', v_total,
        'quantity', 1,
        'discount', 0,
        'total', v_total,
        'line_type', 'package',
        'offer_id', v_offer->>'id',
        'trigger_service_id', v_item.service_id
      ));
    ELSE
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'id', v_item.service_id,
        'code', v_item.service_code,
        'name', v_item.service_name,
        'description', v_item.service_description,
        'price', v_rate,
        'quantity', v_quantity,
        'discount', v_discount,
        'total', CASE WHEN v_mode = 'fixed' THEN GREATEST(v_base_total - v_discount, 0) ELSE v_total END,
        'offer_id', v_offer->>'id',
        'offer_title', v_offer->>'title'
      ));

      IF v_mode = 'fixed' AND v_offer_amount > 0 THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'id', v_offer->>'id',
          'code', 'OFFER-' || COALESCE(v_offer->>'offer_key', 'ADDON'),
          'name', v_offer->>'title',
          'description', v_offer->>'description',
          'price', v_offer_amount,
          'quantity', 1,
          'discount', 0,
          'total', v_offer_amount,
          'line_type', 'booking_engine_offer',
          'offer_id', v_offer->>'id'
        ));
      END IF;
    END IF;

    v_included := COALESCE(v_offer->'included_services', '[]'::jsonb);
    FOR v_component IN SELECT value FROM jsonb_array_elements(v_included)
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
        'line_type', 'included_in_package',
        'included_in_package', true,
        'offer_id', v_offer->>'id',
        'package_title', v_offer->>'title'
      ));
    END LOOP;
  END LOOP;

  RETURN v_lines;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_engine_expand_offer_line_items(uuid) FROM PUBLIC, anon, authenticated;

-- Preserve the existing quotation workflow, then expand its line items with
-- the frozen package composition (included services remain zero-charge lines).
DO $$
BEGIN
  IF to_regprocedure('public.prepare_booking_engine_quotation_base(uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.prepare_booking_engine_quotation(uuid, jsonb)
      RENAME TO prepare_booking_engine_quotation_base;
  END IF;
END;
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
  v_offer jsonb;
  v_quoted_total numeric;
  v_base_total numeric;
  v_offer_amount numeric;
  v_subtotal numeric;
  v_discount numeric;
  v_total numeric;
  v_mode text;
  v_type text;
BEGIN
  v_result := public.prepare_booking_engine_quotation_base(_request_id, _quoted_items);

  v_quotation_id := NULLIF(v_result->>'quotation_id', '')::uuid;
  IF v_quotation_id IS NULL THEN
    RETURN v_result;
  END IF;

  FOR v_item IN
    SELECT ri.id, ri.pricing_snapshot, ro.offer_snapshot
    FROM public.booking_engine_request_items ri
    JOIN public.booking_engine_request_offers ro
      ON ro.request_item_id = ri.id
     AND ro.request_id = ri.request_id
    WHERE ri.request_id = _request_id
  LOOP
    v_offer := v_item.offer_snapshot;
    v_quoted_total := COALESCE(NULLIF(v_item.pricing_snapshot->>'total', '')::numeric, 0);
    v_mode := v_offer->>'price_mode';
    v_type := v_offer->>'offer_type';
    v_offer_amount := COALESCE(NULLIF(v_offer->>'price_value', '')::numeric, 0);
    v_base_total := v_quoted_total;
    v_subtotal := v_quoted_total;
    v_discount := 0;
    v_total := v_quoted_total;

    IF v_mode = 'fixed' AND v_type <> 'package' THEN
      v_base_total := GREATEST(v_quoted_total - v_offer_amount, 0);
    ELSIF v_mode = 'fixed_discount' THEN
      v_discount := LEAST(v_quoted_total, v_offer_amount);
      v_total := GREATEST(v_quoted_total - v_discount, 0);
    ELSIF v_mode = 'percentage_discount' THEN
      v_discount := ROUND(v_quoted_total * LEAST(GREATEST(v_offer_amount, 0), 100) / 100, 2);
      v_total := GREATEST(v_quoted_total - v_discount, 0);
    END IF;

    UPDATE public.booking_engine_request_items
    SET pricing_snapshot = pricing_snapshot || jsonb_build_object(
      'offer', v_offer,
      'offer_id', v_offer->>'id',
      'offer_type', v_type,
      'offer_price_mode', v_mode,
      'offer_amount', CASE WHEN v_mode = 'fixed' THEN v_offer_amount ELSE NULL END,
      'base_total', v_base_total,
      'offer_discount', v_discount,
      'subtotal', v_subtotal,
      'discount_amount', v_discount,
      'total', v_total,
      'included_services', COALESCE(v_offer->'included_services', '[]'::jsonb)
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
REVOKE ALL ON FUNCTION public.prepare_booking_engine_quotation_base(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_booking_engine_quotation_base(uuid, jsonb) TO authenticated;

-- Preserve idempotent ERP conversion, then rebuild the existing line_items JSON
-- from the frozen request snapshots so packages and complimentary services flow
-- into the same booking/invoice/payment lifecycle.
DO $$
BEGIN
  IF to_regprocedure('public.convert_booking_engine_request_base(uuid)') IS NULL THEN
    ALTER FUNCTION public.convert_booking_engine_request(uuid)
      RENAME TO convert_booking_engine_request_base;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_booking_engine_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_booking_id uuid;
BEGIN
  v_result := public.convert_booking_engine_request_base(_request_id);
  v_booking_id := NULLIF(v_result->>'booking_id', '')::uuid;

  IF v_booking_id IS NOT NULL
     AND v_result->>'status' IN ('converted', 'already_converted') THEN
    UPDATE public.bookings
    SET line_items = public.booking_engine_expand_offer_line_items(_request_id),
        updated_at = now()
    WHERE id = v_booking_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_booking_engine_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_booking_engine_request(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.convert_booking_engine_request_base(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_booking_engine_request_base(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_engine_validate_offer_before_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    IF EXISTS (
      SELECT 1
      FROM public.booking_engine_request_offers ro
      LEFT JOIN public.booking_engine_value_offers o ON o.id = ro.offer_id
      WHERE ro.request_id = NEW.id
        AND (
          ro.offer_id IS NULL
          OR o.id IS NULL
          OR o.active IS NOT TRUE
          OR (o.starts_at IS NOT NULL AND o.starts_at > now())
          OR (o.ends_at IS NOT NULL AND o.ends_at <= now())
          OR o.updated_at IS DISTINCT FROM NULLIF(ro.offer_snapshot->>'offer_updated_at', '')::timestamptz
        )
    ) THEN
      RAISE EXCEPTION 'The selected package or offer has changed or expired. Review the offer and calculate your estimate again.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_engine_validate_offer_before_submit
  ON public.booking_engine_requests;

CREATE TRIGGER booking_engine_validate_offer_before_submit
BEFORE UPDATE OF status ON public.booking_engine_requests
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_validate_offer_before_submit();

REVOKE ALL ON FUNCTION public.booking_engine_validate_offer_before_submit() FROM PUBLIC, anon, authenticated;
