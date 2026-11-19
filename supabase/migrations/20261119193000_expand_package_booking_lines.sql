-- Preserve package service sizes and quantities in ERP booking line items.
CREATE OR REPLACE FUNCTION public.booking_engine_expand_offer_line_items_addons_base(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_lines jsonb:='[]'::jsonb; v_item record; v_snapshot jsonb; v_offer jsonb;
  v_offer_type text; v_mode text; v_total numeric; v_base_total numeric; v_offer_amount numeric;
  v_discount numeric; v_rate numeric; v_quantity numeric; v_included jsonb; v_component jsonb;
BEGIN
  FOR v_item IN
    SELECT ri.*,s.service_code,s.name AS service_name,s.description AS service_description
    FROM public.booking_engine_request_items ri JOIN public.services s ON s.id=ri.service_id
    WHERE ri.request_id=_request_id ORDER BY ri.display_order,ri.created_at
  LOOP
    v_snapshot:=COALESCE(v_item.pricing_snapshot,'{}'::jsonb);
    v_offer:=v_snapshot->'offer';
    IF v_offer IS NULL THEN
      v_offer:=v_snapshot->'package';
    END IF;
    v_total:=COALESCE(NULLIF(v_snapshot->>'total','')::numeric,0);
    v_base_total:=COALESCE(NULLIF(v_snapshot->>'base_total','')::numeric,NULLIF(v_snapshot->>'subtotal','')::numeric,v_total);
    v_offer_amount:=COALESCE(NULLIF(v_snapshot->>'offer_amount','')::numeric,0);
    v_discount:=COALESCE(NULLIF(v_snapshot->>'discount_amount','')::numeric,0);
    v_rate:=COALESCE(NULLIF(v_snapshot->>'rate','')::numeric,0);
    v_quantity:=COALESCE(v_item.quantity,1);

    IF v_offer IS NULL THEN
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_item.service_id,'code',v_item.service_code,'name',v_item.service_name,
        'description',v_item.service_description,'price',v_rate,'quantity',v_quantity,'discount',v_discount,'total',v_total));
      CONTINUE;
    END IF;
    v_offer_type:=v_offer->>'offer_type';
    v_mode:=COALESCE(v_snapshot->>'offer_price_mode',v_offer->>'price_mode');

    IF v_offer_type='package' THEN
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_item.service_id,'code',v_offer->>'offer_key',
        'name',v_offer->>'title','description',v_offer->>'description','price',v_total,'quantity',1,'discount',0,'total',v_total,
        'line_type','package','offer_id',v_offer->>'id','trigger_service_id',v_item.service_id));
    ELSE
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_item.service_id,'code',v_item.service_code,'name',v_item.service_name,
        'description',v_item.service_description,'price',v_rate,'quantity',v_quantity,'discount',v_discount,
        'total',CASE WHEN v_mode='fixed' THEN GREATEST(v_base_total-v_discount,0) ELSE v_total END,
        'offer_id',v_offer->>'id','offer_title',v_offer->>'title'));
      IF v_mode='fixed' AND v_offer_amount>0 THEN
        v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_offer->>'id','code','OFFER-'||COALESCE(v_offer->>'offer_key','ADDON'),
          'name',v_offer->>'title','description',v_offer->>'description','price',v_offer_amount,'quantity',1,'discount',0,'total',v_offer_amount,
          'line_type','booking_engine_offer','offer_id',v_offer->>'id'));
      END IF;
    END IF;

    v_included:=COALESCE(v_offer->'package_items',v_offer->'included_services','[]'::jsonb);
    FOR v_component IN SELECT value FROM jsonb_array_elements(v_included) LOOP
      v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
        'id',v_component->>'service_id','code',v_component->>'service_code','name',v_component->>'name',
        'description',v_component->>'description','price',0,'quantity',COALESCE(NULLIF(v_component->>'quantity','')::numeric,1),
        'discount',0,'total',0,'line_type','included_in_package','included_in_package',true,'offer_id',v_offer->>'id',
        'package_title',v_offer->>'title','size_label',v_component->>'size_label',
        'individual_package_price',v_component->'individual_price','complimentary',COALESCE((v_component->>'complimentary')::boolean,true),
        'package_line_total',v_component->'line_total'
      ));
    END LOOP;
  END LOOP;
  RETURN v_lines;
END;
$function$;
COMMENT ON FUNCTION public.booking_engine_expand_offer_line_items_addons_base(uuid)
IS 'Expands selected Booking Engine packages into ERP line items while preserving exact size, quantity, package price and complimentary metadata without double-charging component lines.';