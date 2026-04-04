
-- Add client_id column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Step 1: Insert unique clients from bookings (using phone as unique key)
INSERT INTO public.clients (full_name, phone, whatsapp_number, location, booking_count, total_spend, last_booking_date, status, created_by, created_by_role)
SELECT DISTINCT ON (TRIM(b.client_phone))
  b.client_name,
  TRIM(b.client_phone),
  TRIM(b.client_phone),
  b.location,
  0, 0, NULL, 'new',
  b.agent_id,
  COALESCE(b.created_by_role, 'agent')
FROM public.bookings b
WHERE TRIM(b.client_phone) != ''
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.phone = TRIM(b.client_phone))
ORDER BY TRIM(b.client_phone), b.created_at ASC;

-- Step 2: Insert unique clients from invoices not already in clients
INSERT INTO public.clients (full_name, phone, whatsapp_number, location, booking_count, total_spend, last_booking_date, status, created_by, created_by_role)
SELECT DISTINCT ON (TRIM(i.client_phone))
  i.client_name,
  TRIM(i.client_phone),
  TRIM(i.client_phone),
  NULL,
  0, 0, NULL, 'new',
  i.created_by,
  'admin'
FROM public.invoices i
WHERE i.client_phone IS NOT NULL
  AND TRIM(i.client_phone) != ''
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.phone = TRIM(i.client_phone))
ORDER BY TRIM(i.client_phone), i.created_at ASC;

-- Step 3: Link bookings to clients
UPDATE public.bookings b
SET client_id = c.id
FROM public.clients c
WHERE c.phone = TRIM(b.client_phone)
  AND b.client_id IS NULL;

-- Step 4: Link invoices to clients
UPDATE public.invoices i
SET client_id = c.id
FROM public.clients c
WHERE c.phone = TRIM(i.client_phone)
  AND i.client_id IS NULL;

-- Step 5: Recalculate client stats from bookings
UPDATE public.clients c SET
  booking_count = COALESCE(stats.cnt, 0),
  total_spend = COALESCE(stats.spend, 0),
  last_booking_date = stats.last_date,
  status = CASE
    WHEN COALESCE(stats.spend, 0) >= 50000 THEN 'vip'
    WHEN COALESCE(stats.cnt, 0) > 1 THEN 'returning'
    ELSE 'new'
  END
FROM (
  SELECT client_id, COUNT(*) as cnt, SUM(price) as spend, MAX(service_date) as last_date
  FROM public.bookings
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) stats
WHERE c.id = stats.client_id;
