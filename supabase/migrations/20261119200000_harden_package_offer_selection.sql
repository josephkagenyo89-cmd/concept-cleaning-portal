-- Harden package publishing and selection: the first configured item is the sole booking trigger.
-- All package contents remain in booking_engine_package_items; the link table only identifies the entry service.
ALTER TABLE public.booking_engine_package_items
  DROP CONSTRAINT IF EXISTS package_item_price_check;
ALTER TABLE public.booking_engine_package_items
  ADD CONSTRAINT package_item_price_check CHECK (
    (complimentary IS TRUE AND (individual_price IS NULL OR individual_price = 0))
    OR
    (complimentary IS FALSE AND individual_price IS NOT NULL AND individual_price > 0)
  );

CREATE OR REPLACE FUNCTION public.set_booking_engine_request_offer(_request_id uuid,_request_item_id uuid,_offer_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE; v_item public.booking_engine_request_items%ROWTYPE;
  v_offer public.booking_engine_value_offers%ROWTYPE; v_included jsonb:='[]'::jsonb;
  v_recommended jsonb:='[]'::jsonb; v_package_items jsonb:='[]'::jsonb; v_bad_links integer:=0; v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  SELECT * INTO v_request FROM public.booking_engine_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking request not found.'; END IF;
  IF v_request.status<>'draft' THEN RAISE EXCEPTION 'Offers can only be changed while the request is a draft.'; END IF;
  IF v_request.customer_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'You are not authorized to change this request offer.'; END IF;
  IF v_request.customer_user_id=auth.uid() AND NOT public.owns_client(v_request.customer_id,auth.uid()) THEN RAISE EXCEPTION 'Customer ownership could not be verified.'; END IF;
  SELECT * INTO v_item FROM public.booking_engine_request_items WHERE id=_request_item_id AND request_id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected service item does not belong to this request.'; END IF;
  IF _offer_id IS NULL THEN
    DELETE FROM public.booking_engine_request_offers WHERE request_id=_request_id;
    UPDATE public.booking_engine_request_items SET pricing_snapshot='{}'::jsonb,updated_at=now() WHERE id=_request_item_id;
    RETURN jsonb_build_object('status','cleared','request_id',_request_id);
  END IF;
  SELECT * INTO v_offer FROM public.booking_engine_value_offers WHERE id=_offer_id AND active IS TRUE
    AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This offer is no longer active. Refresh the offers and choose again.'; END IF;
  IF v_offer.offer_type='recurring' THEN RAISE EXCEPTION 'Recurring offers are not yet supported in one-time guided booking.'; END IF;
  IF v_offer.offer_type='package' THEN
    IF v_offer.price_mode<>'fixed' OR COALESCE(v_offer.price_value,0)<=0 THEN RAISE EXCEPTION 'This package does not have an approved fixed price yet.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.booking_engine_package_items pi JOIN public.services s ON s.id=pi.service_id
      WHERE pi.offer_id=v_offer.id AND pi.active IS TRUE AND s.is_active IS TRUE AND pi.service_id=v_item.service_id
      ORDER BY pi.display_order,pi.created_at LIMIT 1) THEN
      RAISE EXCEPTION 'This package does not start with the selected service. Open the package booking link again.';
    END IF;
  ELSE
    IF v_offer.price_mode='percentage_discount' AND (v_offer.price_value IS NULL OR v_offer.price_value<0 OR v_offer.price_value>100) THEN
      RAISE EXCEPTION 'The configured percentage discount must be between 0 and 100.';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.booking_engine_value_offer_services l WHERE l.offer_id=v_offer.id AND l.service_id=v_item.service_id AND l.relationship='trigger') THEN
      RAISE EXCEPTION 'This offer does not apply to the selected service.';
    END IF;
  END IF;
  SELECT count(*) INTO v_bad_links FROM public.booking_engine_value_offer_services l LEFT JOIN public.services s ON s.id=l.service_id
  WHERE l.offer_id=v_offer.id AND l.relationship IN ('included','recommended') AND (s.id IS NULL OR s.is_active IS NOT TRUE);
  IF v_bad_links>0 THEN RAISE EXCEPTION 'This offer contains an inactive or unavailable service. Ask an administrator to update it.'; END IF;
  IF v_offer.offer_type='package' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',pi.id,'service_id',s.id,'service_code',s.service_code,
      'name',COALESCE(NULLIF(pi.item_label,''),s.name),'catalogue_name',s.name,'description',s.description,
      'size_label',pi.size_label,'quantity',pi.quantity,'individual_price',pi.individual_price,'complimentary',pi.complimentary,
      'line_total',CASE WHEN pi.complimentary THEN 0 ELSE pi.individual_price*pi.quantity END,'display_order',pi.display_order)
      ORDER BY pi.display_order,pi.created_at),'[]'::jsonb) INTO v_package_items
    FROM public.booking_engine_package_items pi JOIN public.services s ON s.id=pi.service_id AND s.is_active IS TRUE
    WHERE pi.offer_id=v_offer.id AND pi.active IS TRUE;
    IF jsonb_array_length(v_package_items)=0 THEN RAISE EXCEPTION 'This package has no configured service contents.'; END IF;
    IF EXISTS(SELECT 1 FROM public.booking_engine_package_items pi LEFT JOIN public.services s ON s.id=pi.service_id
      WHERE pi.offer_id=v_offer.id AND pi.active IS TRUE AND (s.id IS NULL OR s.is_active IS NOT TRUE OR NULLIF(trim(pi.size_label),'') IS NULL
        OR pi.quantity<=0 OR (pi.complimentary IS FALSE AND (pi.individual_price IS NULL OR pi.individual_price<=0)))) THEN
      RAISE EXCEPTION 'This package contains an incomplete or unavailable service item.';
    END IF;
    v_included:=v_package_items;
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id',s.id,'service_code',s.service_code,'name',s.name,'description',s.description,'quantity',l.quantity)
      ORDER BY l.created_at,s.name),'[]'::jsonb) INTO v_included
    FROM public.booking_engine_value_offer_services l JOIN public.services s ON s.id=l.service_id WHERE l.offer_id=v_offer.id AND l.relationship='included';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id',s.id,'service_code',s.service_code,'name',s.name,'description',s.description,'quantity',l.quantity)
    ORDER BY l.created_at,s.name),'[]'::jsonb) INTO v_recommended
  FROM public.booking_engine_value_offer_services l JOIN public.services s ON s.id=l.service_id WHERE l.offer_id=v_offer.id AND l.relationship='recommended';
  v_snapshot:=jsonb_build_object('id',v_offer.id,'offer_key',v_offer.offer_key,'title',v_offer.title,'description',v_offer.description,'terms',v_offer.terms,
    'offer_type',v_offer.offer_type,'price_mode',v_offer.price_mode,'price_value',v_offer.price_value,'currency',v_offer.currency,
    'offer_updated_at',v_offer.updated_at,'selected_at',now(),'trigger_service_id',v_item.service_id,
    'included_services',v_included,'recommended_services',v_recommended,'package_items',v_package_items);
  INSERT INTO public.booking_engine_request_offers(request_id,request_item_id,offer_id,offer_snapshot,updated_at)
  VALUES(_request_id,_request_item_id,v_offer.id,v_snapshot,now())
  ON CONFLICT(request_id) DO UPDATE SET request_item_id=EXCLUDED.request_item_id,offer_id=EXCLUDED.offer_id,offer_snapshot=EXCLUDED.offer_snapshot,updated_at=now();
  UPDATE public.booking_engine_request_items SET pricing_snapshot='{}'::jsonb,updated_at=now() WHERE id=_request_item_id;
  RETURN jsonb_build_object('status','selected','request_id',_request_id,'offer',v_snapshot);
END;
$function$;

COMMENT ON FUNCTION public.set_booking_engine_request_offer(uuid,uuid,uuid)
IS 'Selects an active offer with ownership checks; packages are validated against their first active configured service and snapshotted with every size, quantity and price.';