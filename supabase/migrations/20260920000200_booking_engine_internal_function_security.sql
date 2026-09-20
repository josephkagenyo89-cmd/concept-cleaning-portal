-- Prevent Booking Engine internal helper/trigger functions from being
-- callable through the public API.
-- Do not change function definitions or business logic.

REVOKE EXECUTE
ON FUNCTION public.booking_engine_is_valid_transition(
  public.booking_engine_request_status,
  public.booking_engine_request_status
)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.booking_engine_set_updated_at()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.booking_engine_validate_status_transition()
FROM PUBLIC, anon, authenticated;
