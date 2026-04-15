
-- Add signature fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_signature text,
  ADD COLUMN IF NOT EXISTS staff_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_signed_name text;

-- Add fully_confirmed to booking_status enum
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'fully_confirmed';

-- Create signature tokens table
CREATE TABLE public.signature_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.signature_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens need to be readable by anon for public signature page
CREATE POLICY "Anyone can view tokens by token value"
  ON public.signature_tokens FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tokens"
  ON public.signature_tokens FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Anyone can mark tokens used"
  ON public.signature_tokens FOR UPDATE
  USING (true);
