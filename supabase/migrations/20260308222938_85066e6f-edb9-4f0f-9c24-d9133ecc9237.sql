
CREATE POLICY "Admins can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_super(auth.uid()));
