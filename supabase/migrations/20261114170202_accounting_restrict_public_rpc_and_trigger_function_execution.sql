
DO $block$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'accounting_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',r.signature);
    IF r.signature::text NOT LIKE 'accounting_create_posted_journal(%' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.signature);
    END IF;
  END LOOP;
END;
$block$;

REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid,numeric,text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid,numeric,text,text,date) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
