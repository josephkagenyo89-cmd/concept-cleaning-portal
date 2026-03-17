
ALTER TABLE public.income_records 
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD CONSTRAINT income_records_invoice_id_unique UNIQUE (invoice_id);
