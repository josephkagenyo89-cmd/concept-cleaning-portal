
CREATE OR REPLACE FUNCTION public.next_quotation_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CCS-QT-' || nextval('public.quotation_number_seq')::text
$$;
