CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_client_id uuid;
  cust_phone text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'customer' THEN
    cust_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

    SELECT id INTO existing_client_id FROM public.clients WHERE phone = cust_phone LIMIT 1;

    IF existing_client_id IS NOT NULL THEN
      UPDATE public.clients
         SET user_id = COALESCE(user_id, NEW.id),
             full_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), full_name),
             whatsapp_number = COALESCE(NULLIF(NEW.raw_user_meta_data->>'whatsapp_number',''), whatsapp_number, cust_phone),
             location = COALESCE(NULLIF(NEW.raw_user_meta_data->>'location',''), location),
             updated_at = now()
       WHERE id = existing_client_id;
      RETURN NEW;
    END IF;

    INSERT INTO public.clients (full_name, phone, whatsapp_number, location, notes, status, created_by, created_by_role, user_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      cust_phone,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'whatsapp_number',''), cust_phone),
      COALESCE(NEW.raw_user_meta_data->>'location', ''),
      NULLIF(NEW.raw_user_meta_data->>'notes',''),
      'new',
      NEW.id,
      'customer',
      NEW.id
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone, town_estate, mpesa_number, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'town_estate', ''),
    COALESCE(NEW.raw_user_meta_data->>'mpesa_number', ''),
    NEW.raw_user_meta_data->>'referral_code'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  RETURN NEW;
END;
$function$;