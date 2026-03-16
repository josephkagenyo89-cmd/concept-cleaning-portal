
-- Allow admins to insert bookings
CREATE POLICY "Admins can create bookings" ON public.bookings FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));
