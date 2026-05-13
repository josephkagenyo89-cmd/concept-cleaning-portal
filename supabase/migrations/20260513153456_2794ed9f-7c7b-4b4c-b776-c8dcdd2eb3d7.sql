-- Pest Management module tables, RLS, sequence, helpers, and storage bucket

-- Sequence + helper for pest certificate numbers
CREATE SEQUENCE IF NOT EXISTS public.pest_certificate_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_pest_certificate_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CCS-PEST-' || LPAD(nextval('public.pest_certificate_number_seq')::text, 4, '0')
$$;

-- Reuse existing public.update_updated_at trigger function

-- pest_jobs: header
CREATE TABLE public.pest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text,
  client_id uuid,
  client_name text NOT NULL,
  client_phone text,
  client_location text,
  pest_type text,
  infestation_level text,
  status text NOT NULL DEFAULT 'inspection', -- inspection|treatment|completed|cancelled
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  technician_id uuid,
  technician_name text,
  invoice_id uuid,
  booking_id uuid,
  price numeric NOT NULL DEFAULT 0,
  notes text,
  client_signature text,
  client_signed_at timestamptz,
  created_by uuid NOT NULL,
  created_by_name text,
  created_by_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_jobs_client ON public.pest_jobs(client_id);
CREATE INDEX idx_pest_jobs_status ON public.pest_jobs(status);
CREATE TRIGGER trg_pest_jobs_updated BEFORE UPDATE ON public.pest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- pest_inspections: 1:1
CREATE TABLE public.pest_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  pest_type text,
  infestation_level text, -- low|medium|high|severe
  affected_areas text,
  client_observations text,
  technician_notes text,
  inspected_by uuid,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_inspections_job ON public.pest_inspections(pest_job_id);
CREATE TRIGGER trg_pest_inspections_updated BEFORE UPDATE ON public.pest_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- pest_treatments
CREATE TABLE public.pest_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  treatment_method text,
  equipment_used text,
  ppe_used text,
  safety_instructions text,
  client_acknowledged boolean NOT NULL DEFAULT false,
  performed_by uuid,
  performed_by_name text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_treatments_job ON public.pest_treatments(pest_job_id);

-- pest_chemical_usage
CREATE TABLE public.pest_chemical_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.pest_treatments(id) ON DELETE SET NULL,
  chemical_name text NOT NULL,
  dosage text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'ml',
  used_on date NOT NULL DEFAULT CURRENT_DATE,
  technician_id uuid,
  technician_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_chem_job ON public.pest_chemical_usage(pest_job_id);
CREATE INDEX idx_pest_chem_date ON public.pest_chemical_usage(used_on);

-- pest_areas_treated
CREATE TABLE public.pest_areas_treated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  area_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_areas_job ON public.pest_areas_treated(pest_job_id);

-- pest_followups
CREATE TABLE public.pest_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  followup_type text NOT NULL DEFAULT 'followup', -- followup|reinspection|retreatment
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled|completed|cancelled
  notes text,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_followups_job ON public.pest_followups(pest_job_id);
CREATE INDEX idx_pest_followups_date ON public.pest_followups(scheduled_date);

-- pest_photos (storage path in pest-photos bucket)
CREATE TABLE public.pest_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'evidence', -- before|after|evidence
  caption text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_photos_job ON public.pest_photos(pest_job_id);

-- pest_certificates
CREATE TABLE public.pest_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL,
  pest_job_id uuid NOT NULL REFERENCES public.pest_jobs(id) ON DELETE CASCADE,
  client_id uuid,
  client_name text NOT NULL,
  client_phone text,
  client_location text,
  treatment_summary text,
  chemicals_summary text,
  safety_recommendations text,
  warranty_days integer NOT NULL DEFAULT 0,
  warranty_expiry date,
  free_revisit_eligible boolean NOT NULL DEFAULT false,
  amount_paid numeric NOT NULL DEFAULT 0,
  mpesa_code text,
  payment_date timestamptz,
  invoice_id uuid,
  invoice_number text,
  client_signature text,
  client_signed_at timestamptz,
  staff_signature text,
  staff_signed_name text,
  staff_signed_at timestamptz,
  generated_by uuid NOT NULL,
  generated_by_name text,
  generated_by_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pest_certs_job ON public.pest_certificates(pest_job_id);
CREATE INDEX idx_pest_certs_expiry ON public.pest_certificates(warranty_expiry);

-- Enable RLS
ALTER TABLE public.pest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_chemical_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_areas_treated ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pest_certificates ENABLE ROW LEVEL SECURITY;

-- Policies: admin/super_admin manage; agents see jobs they created
CREATE POLICY "Admins manage pest jobs" ON public.pest_jobs FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()) OR auth.uid() = created_by);
CREATE POLICY "Agents view own pest jobs" ON public.pest_jobs FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = technician_id);

-- Helper: pest job admin/owner check inline in each policy
CREATE POLICY "Admins manage pest inspections" ON public.pest_inspections FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Owners view inspections" ON public.pest_inspections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pest_jobs j WHERE j.id = pest_job_id AND (j.created_by = auth.uid() OR j.technician_id = auth.uid())));

CREATE POLICY "Admins manage pest treatments" ON public.pest_treatments FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Owners view treatments" ON public.pest_treatments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pest_jobs j WHERE j.id = pest_job_id AND (j.created_by = auth.uid() OR j.technician_id = auth.uid())));

CREATE POLICY "Admins manage pest chem" ON public.pest_chemical_usage FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Owners view chem" ON public.pest_chemical_usage FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pest_jobs j WHERE j.id = pest_job_id AND (j.created_by = auth.uid() OR j.technician_id = auth.uid())));

CREATE POLICY "Admins manage pest areas" ON public.pest_areas_treated FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Owners view areas" ON public.pest_areas_treated FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pest_jobs j WHERE j.id = pest_job_id AND (j.created_by = auth.uid() OR j.technician_id = auth.uid())));

CREATE POLICY "Admins manage pest followups" ON public.pest_followups FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Owners view followups" ON public.pest_followups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pest_jobs j WHERE j.id = pest_job_id AND (j.created_by = auth.uid() OR j.technician_id = auth.uid())));

CREATE POLICY "Admins manage pest photos" ON public.pest_photos FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));
CREATE POLICY "Owners view photos" ON public.pest_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pest_jobs j WHERE j.id = pest_job_id AND (j.created_by = auth.uid() OR j.technician_id = auth.uid())));

CREATE POLICY "Admins create pest certs" ON public.pest_certificates FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_super(auth.uid()) AND auth.uid() = generated_by);
CREATE POLICY "Admins view pest certs" ON public.pest_certificates FOR SELECT TO authenticated
  USING (is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins delete pest certs" ON public.pest_certificates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Owners view own pest certs" ON public.pest_certificates FOR SELECT TO authenticated
  USING (auth.uid() = generated_by);

-- Storage bucket for pest photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('pest-photos', 'pest-photos', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read pest photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pest-photos' AND is_admin_or_super(auth.uid()));
CREATE POLICY "Admins upload pest photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pest-photos' AND is_admin_or_super(auth.uid()));
CREATE POLICY "Admins delete pest photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pest-photos' AND is_admin_or_super(auth.uid()));
