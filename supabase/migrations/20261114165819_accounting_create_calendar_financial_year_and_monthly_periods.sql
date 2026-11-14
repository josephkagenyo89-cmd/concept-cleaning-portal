
CREATE OR REPLACE FUNCTION public.accounting_create_financial_year(p_year integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $function$
DECLARE
  v_year_id uuid;
  v_start date;
  v_month_start date;
  v_month_end date;
  v_month integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only authorised accounting administrators may create financial years';
  END IF;
  IF p_year IS NULL OR p_year<2000 OR p_year>EXTRACT(YEAR FROM CURRENT_DATE)::integer+2 THEN
    RAISE EXCEPTION 'Financial year must be between 2000 and two years ahead';
  END IF;
  v_start:=make_date(p_year,1,1);
  IF EXISTS(SELECT 1 FROM public.accounting_financial_years WHERE starts_on=v_start OR name='FY '||p_year) THEN
    RAISE EXCEPTION 'Financial year % already exists',p_year;
  END IF;
  INSERT INTO public.accounting_financial_years(name,starts_on,ends_on,status,created_by)
  VALUES('FY '||p_year,v_start,make_date(p_year,12,31),'open',auth.uid())
  RETURNING id INTO v_year_id;

  FOR v_month IN 1..12 LOOP
    v_month_start:=make_date(p_year,v_month,1);
    v_month_end:=(v_month_start+interval '1 month - 1 day')::date;
    INSERT INTO public.accounting_periods(name,starts_on,ends_on,status,created_by,financial_year_id)
    VALUES(to_char(v_month_start,'FMMonth YYYY'),v_month_start,v_month_end,'open',auth.uid(),v_year_id);
  END LOOP;
  RETURN v_year_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accounting_create_financial_year(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accounting_create_financial_year(integer) TO authenticated;
