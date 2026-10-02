-- ============================================================
-- CONCEPT CLEANING SERVICES
-- CRM FOUNDATION — PHASE 1
-- Leads + Activities + Tasks
--
-- IMPORTANT:
-- - Uses existing public.clients as the customer master.
-- - Does NOT create a replacement customers table.
-- - Does NOT modify bookings, quotations, invoices, income,
--   services, or pest operations.
-- ============================================================

-- ============================================================
-- 1. LEADS
-- ============================================================

CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  lead_code TEXT UNIQUE,

  full_name TEXT NOT NULL,
  phone TEXT,
  whatsapp_number TEXT,
  email TEXT,
  location TEXT,

  service_interest TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

  source TEXT NOT NULL DEFAULT 'other',

  status TEXT NOT NULL DEFAULT 'new'
    CHECK (
      status IN (
        'new',
        'contacted',
        'qualified',
        'proposal',
        'negotiation',
        'won',
        'lost',
        'converted'
      )
    ),

  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (
      priority IN (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  estimated_value NUMERIC NOT NULL DEFAULT 0
    CHECK (estimated_value >= 0),

  notes TEXT,

  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  lost_reason TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT leads_converted_client_consistency
    CHECK (
      (status = 'converted' AND converted_client_id IS NOT NULL)
      OR
      (status <> 'converted')
    )
);

-- ============================================================
-- 2. CRM ACTIVITIES
-- ============================================================

CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL
    CHECK (
      activity_type IN (
        'call',
        'whatsapp',
        'sms',
        'email',
        'meeting',
        'note',
        'quotation',
        'booking',
        'follow_up',
        'complaint',
        'other'
      )
    ),

  subject TEXT NOT NULL,
  description TEXT,

  activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  outcome TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT crm_activities_parent_check
    CHECK (
      client_id IS NOT NULL
      OR lead_id IS NOT NULL
    )
);

-- ============================================================
-- 3. CRM TASKS / FOLLOW-UPS
-- ============================================================

CREATE TABLE public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,

  task_type TEXT NOT NULL DEFAULT 'follow_up'
    CHECK (
      task_type IN (
        'follow_up',
        'call',
        'whatsapp',
        'email',
        'meeting',
        'quotation',
        'booking',
        'payment',
        'complaint',
        'other'
      )
    ),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (
      priority IN (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  due_at TIMESTAMPTZ,

  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  completed_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT crm_tasks_parent_check
    CHECK (
      client_id IS NOT NULL
      OR lead_id IS NOT NULL
    )
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX idx_leads_status
  ON public.leads(status);

CREATE INDEX idx_leads_phone
  ON public.leads(phone);

CREATE INDEX idx_leads_source
  ON public.leads(source);

CREATE INDEX idx_leads_assigned_to
  ON public.leads(assigned_to);

CREATE INDEX idx_leads_converted_client
  ON public.leads(converted_client_id);

CREATE INDEX idx_leads_created_at
  ON public.leads(created_at DESC);

CREATE INDEX idx_crm_activities_client
  ON public.crm_activities(client_id);

CREATE INDEX idx_crm_activities_lead
  ON public.crm_activities(lead_id);

CREATE INDEX idx_crm_activities_date
  ON public.crm_activities(activity_date DESC);

CREATE INDEX idx_crm_tasks_client
  ON public.crm_tasks(client_id);

CREATE INDEX idx_crm_tasks_lead
  ON public.crm_tasks(lead_id);

CREATE INDEX idx_crm_tasks_assigned_to
  ON public.crm_tasks(assigned_to);

CREATE INDEX idx_crm_tasks_status
  ON public.crm_tasks(status);

CREATE INDEX idx_crm_tasks_due_at
  ON public.crm_tasks(due_at);

-- ============================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_crm_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_updated_at();

CREATE TRIGGER crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crm_updated_at();

-- ============================================================
-- 6. RLS
-- ============================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- LEADS
-- ------------------------------------------------------------

CREATE POLICY "Admins can view all leads"
  ON public.leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can create leads"
  ON public.leads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update leads"
  ON public.leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can delete leads"
  ON public.leads
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ------------------------------------------------------------
-- ACTIVITIES
-- ------------------------------------------------------------

CREATE POLICY "Admins can view CRM activities"
  ON public.crm_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can create CRM activities"
  ON public.crm_activities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update CRM activities"
  ON public.crm_activities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can delete CRM activities"
  ON public.crm_activities
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ------------------------------------------------------------
-- TASKS
-- ------------------------------------------------------------

CREATE POLICY "Admins can view CRM tasks"
  ON public.crm_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can create CRM tasks"
  ON public.crm_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update CRM tasks"
  ON public.crm_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can delete CRM tasks"
  ON public.crm_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ============================================================
-- 7. LEAD CODE GENERATION
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.lead_code_seq
  START WITH 1
  INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_lead_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number BIGINT;
BEGIN
  next_number := nextval('public.lead_code_seq');

  RETURN 'LEAD-' || LPAD(next_number::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_lead_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lead_code IS NULL OR NEW.lead_code = '' THEN
    NEW.lead_code := public.next_lead_code();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_assign_code
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_lead_code();

-- ============================================================
-- 8. COMMENTS
-- ============================================================

COMMENT ON TABLE public.leads IS
  'CRM sales leads. Converts into the existing clients table.';

COMMENT ON TABLE public.crm_activities IS
  'General CRM interaction history for leads and existing clients.';

COMMENT ON TABLE public.crm_tasks IS
  'CRM tasks and follow-ups linked to leads and/or existing clients.';
