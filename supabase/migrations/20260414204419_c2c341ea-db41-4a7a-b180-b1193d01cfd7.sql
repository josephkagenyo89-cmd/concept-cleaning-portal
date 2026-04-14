
-- Add line_items JSONB to bookings for multi-service support
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;
