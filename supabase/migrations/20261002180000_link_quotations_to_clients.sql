ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);

CREATE INDEX IF NOT EXISTS idx_quotations_client_id
ON public.quotations(client_id);
