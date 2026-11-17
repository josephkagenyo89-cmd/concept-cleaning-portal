-- Pin the search path for privileged Smart Booking workflow RPCs.
-- Every relation and project function in these bodies is schema-qualified.
ALTER FUNCTION public.transition_booking_engine_request_admin(uuid,public.booking_engine_request_status,text) SET search_path = '';
ALTER FUNCTION public.assign_booking_engine_request_admin(uuid,uuid) SET search_path = '';
ALTER FUNCTION public.respond_booking_engine_clarification(uuid,text) SET search_path = '';
ALTER FUNCTION public.cancel_booking_engine_request(uuid,text) SET search_path = '';
