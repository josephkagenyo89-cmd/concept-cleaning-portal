
-- Add salesperson fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS salesperson_id uuid,
  ADD COLUMN IF NOT EXISTS salesperson_name text,
  ADD COLUMN IF NOT EXISTS salesperson_role text;

-- Add salesperson and line_items to quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS salesperson_id uuid,
  ADD COLUMN IF NOT EXISTS salesperson_name text,
  ADD COLUMN IF NOT EXISTS salesperson_role text,
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;

-- Add salesperson and line_items to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS salesperson_id uuid,
  ADD COLUMN IF NOT EXISTS salesperson_name text,
  ADD COLUMN IF NOT EXISTS salesperson_role text,
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;

-- Backfill existing data: set salesperson = created_by where missing
UPDATE public.bookings SET salesperson_name = created_by_name, salesperson_role = COALESCE(created_by_role, 'agent'), salesperson_id = agent_id WHERE salesperson_name IS NULL;
UPDATE public.quotations SET salesperson_name = created_by_name, salesperson_role = COALESCE(created_by_role, 'agent'), salesperson_id = created_by WHERE salesperson_name IS NULL;
