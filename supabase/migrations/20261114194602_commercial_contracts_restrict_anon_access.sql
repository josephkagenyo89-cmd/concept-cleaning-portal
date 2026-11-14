-- Restrict direct access to commercial contract tables to authenticated users.
-- Row-level security policies remain responsible for administrator authorization.
REVOKE ALL ON TABLE
  public.service_contracts,
  public.service_contract_sites,
  public.service_contract_schedules,
  public.service_contract_visits
FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.service_contracts,
  public.service_contract_sites,
  public.service_contract_schedules,
  public.service_contract_visits
TO authenticated;

REVOKE ALL ON SEQUENCE public.service_contract_number_seq FROM anon, PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE public.service_contract_number_seq TO authenticated;
