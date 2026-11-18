-- Reuse customer_feedback for customer reviews; do not create a second reviews table.
-- Existing staff feedback remains private and unchanged.
ALTER TABLE public.customer_feedback
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS public_display_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_source_check,
  DROP CONSTRAINT IF EXISTS customer_feedback_publication_status_check;
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_source_check CHECK (source IN ('staff', 'signature')),
  ADD CONSTRAINT customer_feedback_publication_status_check CHECK (publication_status IN ('not_requested', 'private', 'pending', 'approved', 'hidden'));

CREATE UNIQUE INDEX IF NOT EXISTS customer_feedback_one_signature_review_per_booking
  ON public.customer_feedback (booking_id)
  WHERE source = 'signature' AND booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_feedback_public_homepage_idx
  ON public.customer_feedback (is_featured DESC, created_at DESC)
  WHERE source = 'signature' AND public_display_consent = true AND publication_status = 'approved' AND is_complaint = false;

DROP POLICY IF EXISTS "Admins can moderate customer feedback" ON public.customer_feedback;
CREATE POLICY "Admins can moderate customer feedback"
  ON public.customer_feedback FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- New links use a 12-hour default. Existing token expiry timestamps are not changed.
ALTER TABLE public.signature_tokens ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 hours');
