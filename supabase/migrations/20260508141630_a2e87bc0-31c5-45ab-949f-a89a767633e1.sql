CREATE TABLE public.customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid,
  client_id uuid,
  client_name text NOT NULL,
  agent_id uuid,
  agent_name text,
  service_name text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_complaint boolean NOT NULL DEFAULT false,
  submitted_by uuid,
  submitted_by_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_feedback_rating ON public.customer_feedback(rating);
CREATE INDEX idx_customer_feedback_created ON public.customer_feedback(created_at DESC);
CREATE INDEX idx_customer_feedback_booking ON public.customer_feedback(booking_id);
CREATE INDEX idx_customer_feedback_agent ON public.customer_feedback(agent_id);

ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all feedback"
  ON public.customer_feedback FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Agents can view own feedback"
  ON public.customer_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id OR auth.uid() = submitted_by);

CREATE POLICY "Authenticated can submit feedback"
  ON public.customer_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Super admins can delete feedback"
  ON public.customer_feedback FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));