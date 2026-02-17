
-- Create enums for notice system
CREATE TYPE public.notice_target_role AS ENUM ('agent', 'admin', 'all');
CREATE TYPE public.notice_priority AS ENUM ('normal', 'important', 'urgent');

-- Create notices table
CREATE TABLE public.notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_role notice_target_role NOT NULL DEFAULT 'agent',
  priority notice_priority NOT NULL DEFAULT 'normal',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  requires_acknowledgement BOOLEAN NOT NULL DEFAULT false,
  is_blocking BOOLEAN NOT NULL DEFAULT false,
  acknowledgement_deadline TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notice acknowledgements table
CREATE TABLE public.notice_acknowledgements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  UNIQUE(notice_id, user_id)
);

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_acknowledgements ENABLE ROW LEVEL SECURITY;

-- RLS for notices: authenticated users can view active notices matching their role
CREATE POLICY "Users can view targeted notices"
ON public.notices FOR SELECT
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    target_role = 'all'
    OR (target_role = 'agent' AND has_role(auth.uid(), 'agent'))
    OR (target_role = 'admin' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')))
  )
);

-- Admins can also view all notices for management
CREATE POLICY "Admins can view all notices"
ON public.notices FOR SELECT
USING (is_admin_or_super(auth.uid()));

-- Super admins can create any notice
CREATE POLICY "Super admins can create notices"
ON public.notices FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin') AND auth.uid() = created_by
);

-- Admins can create notices targeting agents only
CREATE POLICY "Admins can create agent notices"
ON public.notices FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') AND target_role = 'agent' AND auth.uid() = created_by
);

-- Super admins can update any notice
CREATE POLICY "Super admins can update notices"
ON public.notices FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'));

-- Admins can update their own agent-targeted notices
CREATE POLICY "Admins can update own agent notices"
ON public.notices FOR UPDATE
USING (has_role(auth.uid(), 'admin') AND created_by = auth.uid() AND target_role = 'agent');

-- Super admins can delete any notice
CREATE POLICY "Super admins can delete notices"
ON public.notices FOR DELETE
USING (has_role(auth.uid(), 'super_admin'));

-- Admins can delete their own agent-targeted notices
CREATE POLICY "Admins can delete own notices"
ON public.notices FOR DELETE
USING (has_role(auth.uid(), 'admin') AND created_by = auth.uid() AND target_role = 'agent');

-- Acknowledgements: users can insert their own
CREATE POLICY "Users can acknowledge notices"
ON public.notice_acknowledgements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view own acknowledgements
CREATE POLICY "Users can view own acknowledgements"
ON public.notice_acknowledgements FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view acknowledgements for analytics
CREATE POLICY "Admins can view all acknowledgements"
ON public.notice_acknowledgements FOR SELECT
USING (is_admin_or_super(auth.uid()));
