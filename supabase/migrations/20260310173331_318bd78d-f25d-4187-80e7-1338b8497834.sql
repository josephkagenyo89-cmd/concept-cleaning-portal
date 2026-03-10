
-- Add service configuration columns for dynamic inputs
ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS input_type text NOT NULL DEFAULT 'number',
  ADD COLUMN IF NOT EXISTS dropdown_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_unit text NOT NULL DEFAULT 'unit';

-- Add booking price tracking columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS system_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_margin numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity text DEFAULT NULL;
