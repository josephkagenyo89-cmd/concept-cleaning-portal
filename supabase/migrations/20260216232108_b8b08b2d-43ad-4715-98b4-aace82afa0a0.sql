
-- Create profile_edit_requests table
CREATE TABLE public.profile_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposed_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id uuid,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT one_pending_per_user UNIQUE (user_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- We need a partial unique index instead for the "one pending per user" constraint
ALTER TABLE public.profile_edit_requests DROP CONSTRAINT one_pending_per_user;
CREATE UNIQUE INDEX idx_one_pending_per_user ON public.profile_edit_requests (user_id) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.profile_edit_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own edit requests"
ON public.profile_edit_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can submit edit requests"
ON public.profile_edit_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view agent edit requests
CREATE POLICY "Admins can view agent edit requests"
ON public.profile_edit_requests
FOR SELECT
USING (
  is_admin_or_super(auth.uid())
);

-- Admins can update (approve/reject) requests
CREATE POLICY "Admins can update edit requests"
ON public.profile_edit_requests
FOR UPDATE
USING (
  is_admin_or_super(auth.uid())
  AND auth.uid() != user_id
);

-- Function to approve a profile edit request
CREATE OR REPLACE FUNCTION public.approve_profile_edit(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
  requester_role app_role;
  reviewer_role app_role;
BEGIN
  SELECT * INTO req FROM profile_edit_requests WHERE id = request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Prevent self-approval
  IF req.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot approve your own request';
  END IF;

  -- Get requester's highest role
  SELECT role INTO requester_role FROM user_roles WHERE user_id = req.user_id ORDER BY 
    CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'agent' THEN 3 END
    LIMIT 1;

  -- Get reviewer's highest role
  SELECT role INTO reviewer_role FROM user_roles WHERE user_id = auth.uid() ORDER BY
    CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'agent' THEN 3 END
    LIMIT 1;

  -- Enforce approval hierarchy
  IF requester_role = 'admin' AND reviewer_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only Super Admins can approve admin profile edits';
  END IF;

  IF requester_role = 'agent' AND reviewer_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only Admins or Super Admins can approve agent profile edits';
  END IF;

  -- Apply the proposed changes to profiles
  UPDATE profiles SET
    full_name = COALESCE(req.proposed_data->>'full_name', full_name),
    phone = COALESCE(req.proposed_data->>'phone', phone),
    town_estate = COALESCE(req.proposed_data->>'town_estate', town_estate),
    mpesa_number = COALESCE(req.proposed_data->>'mpesa_number', mpesa_number),
    updated_at = now()
  WHERE user_id = req.user_id;

  -- Mark request as approved
  UPDATE profile_edit_requests SET
    status = 'approved',
    reviewer_id = auth.uid(),
    reviewed_at = now()
  WHERE id = request_id;
END;
$$;
