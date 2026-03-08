
-- Mass emails table
CREATE TABLE public.mass_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  audience_type text NOT NULL DEFAULT 'agent' CHECK (audience_type IN ('agent', 'admin', 'all')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mass_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mass emails" ON public.mass_emails
  FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()) AND auth.uid() = created_by);

-- Mass email logs table
CREATE TABLE public.mass_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL REFERENCES public.mass_emails(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  recipient_email text NOT NULL,
  recipient_role text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mass_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email logs" ON public.mass_email_logs
  FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

-- Allow conversations to be updated (for timestamp updates)
CREATE POLICY "Admins can update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Agents can update own conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = agent_id);
