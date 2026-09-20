-- Restrict Booking Engine API-callable functions to authenticated users.
-- Do not change existing business logic or function definitions.

REVOKE EXECUTE
ON FUNCTION public.accept_booking_engine_quotation(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.add_booking_engine_request_item(UUID, UUID, NUMERIC, JSONB, JSONB, JSONB)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.calculate_booking_engine_item_price(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.calculate_booking_engine_request_price(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.convert_booking_engine_request(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.create_booking_engine_request(DATE, TIME, TEXT, TEXT)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.delete_booking_engine_request_item(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.mark_booking_engine_ready_for_booking(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.next_booking_engine_request_number()
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.prepare_booking_engine_quotation(UUID, JSONB)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.submit_booking_engine_request(UUID)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.update_booking_engine_request(UUID, DATE, TIME, TEXT, TEXT, BOOLEAN)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.update_booking_engine_request_item(UUID, NUMERIC, JSONB, JSONB, JSONB)
FROM anon;

-- Internal helper/trigger functions must not be callable through the API.
REVOKE EXECUTE
ON FUNCTION public.booking_engine_is_valid_transition(public.booking_engine_request_status, public.booking_engine_request_status)
FROM anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.booking_engine_set_updated_at()
FROM anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.booking_engine_validate_status_transition()
FROM anon, authenticated;
