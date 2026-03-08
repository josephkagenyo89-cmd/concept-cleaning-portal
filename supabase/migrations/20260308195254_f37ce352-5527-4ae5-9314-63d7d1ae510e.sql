
ALTER TABLE public.services
  ADD COLUMN requires_size_input boolean NOT NULL DEFAULT false,
  ADD COLUMN price_per_sqm numeric NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
  ADD COLUMN size_sqm numeric NULL;
