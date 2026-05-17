-- Offline-first: add local_id idempotency keys to support safe retry of offline-created records.
-- All columns are nullable, additive only. Existing rows and queries unaffected.

ALTER TABLE public.bookings              ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.clients               ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.invoices              ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.quotations            ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.service_certificates  ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.pest_jobs             ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.pest_inspections      ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.pest_treatments       ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.pest_chemical_usage   ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.pest_followups        ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.customer_feedback     ADD COLUMN IF NOT EXISTS local_id text;
ALTER TABLE public.pest_photos           ADD COLUMN IF NOT EXISTS local_id text;

-- Unique partial indexes (only enforce uniqueness when local_id is provided)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_local_id_uniq             ON public.bookings(local_id)             WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_local_id_uniq              ON public.clients(local_id)              WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_local_id_uniq             ON public.invoices(local_id)             WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_local_id_uniq           ON public.quotations(local_id)           WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS service_certificates_local_id_uniq ON public.service_certificates(local_id) WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pest_jobs_local_id_uniq            ON public.pest_jobs(local_id)            WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pest_inspections_local_id_uniq     ON public.pest_inspections(local_id)     WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pest_treatments_local_id_uniq      ON public.pest_treatments(local_id)      WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pest_chemical_usage_local_id_uniq  ON public.pest_chemical_usage(local_id)  WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pest_followups_local_id_uniq       ON public.pest_followups(local_id)       WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_feedback_local_id_uniq    ON public.customer_feedback(local_id)    WHERE local_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pest_photos_local_id_uniq          ON public.pest_photos(local_id)          WHERE local_id IS NOT NULL;