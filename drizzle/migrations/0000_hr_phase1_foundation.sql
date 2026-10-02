CREATE TABLE IF NOT EXISTS public.hr_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  manager_employee_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hr_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text UNIQUE,
  department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS public.employee_code_seq START 1;
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  full_name text,
  email text, phone text, alternate_phone text, national_id text,
  date_of_birth date, gender text, marital_status text,
  physical_address text, town text, county text,
  emergency_contact_name text, emergency_contact_phone text, emergency_contact_relationship text,
  department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.hr_positions(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employment_type text,
  employment_status text NOT NULL DEFAULT 'active',
  hire_date date, probation_end_date date, termination_date date,
  work_location text, notes text, photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_departments DROP CONSTRAINT IF EXISTS hr_departments_manager_fk;
ALTER TABLE public.hr_departments ADD CONSTRAINT hr_departments_manager_fk FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.employee_employment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.hr_positions(id) ON DELETE SET NULL,
  employment_type text, employment_status text,
  start_date date, end_date date,
  salary_amount numeric, salary_frequency text,
  supervisor_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  work_location text, contract_reference text, notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.employee_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_title text NOT NULL,
  description text,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_position ON public.employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employment_employee ON public.employee_employment(employee_id);
CREATE INDEX IF NOT EXISTS idx_timeline_employee ON public.employee_timeline(employee_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_departments, public.hr_positions, public.employees, public.employee_employment, public.employee_timeline TO authenticated;
GRANT ALL ON public.hr_departments, public.hr_positions, public.employees, public.employee_employment, public.employee_timeline TO service_role;
GRANT USAGE ON SEQUENCE public.employee_code_seq TO service_role;

ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_employment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR admins manage departments" ON public.hr_departments FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins manage positions" ON public.hr_positions FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins select employees" ON public.employees FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins update employees" ON public.employees FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admin deletes employees" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "HR admins manage employment" ON public.employee_employment FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins read timeline" ON public.employee_timeline FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "HR admins add timeline" ON public.employee_timeline FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_employee_code() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CCS-EMP-' || lpad(nextval('public.employee_code_seq')::text, 5, '0')
$$;

CREATE OR REPLACE FUNCTION public.employees_before_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.employee_code IS NULL OR btrim(NEW.employee_code) = '' THEN
      LOOP
        NEW.employee_code := public.next_employee_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_code = NEW.employee_code);
      END LOOP;
    END IF;
  ELSE
    NEW.employee_code := OLD.employee_code;
  END IF;
  NEW.full_name := btrim(concat_ws(' ', NEW.first_name, NULLIF(NEW.middle_name,''), NEW.last_name));
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.employees_after_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.employee_timeline(employee_id, event_type, event_title, description, created_by)
    VALUES (NEW.id, 'created', 'Employee Created', NEW.full_name || ' (' || NEW.employee_code || ') added to HR', _uid);
    INSERT INTO public.employee_employment(employee_id, department_id, position_id, employment_type, employment_status, start_date, supervisor_employee_id, work_location, notes)
    VALUES (NEW.id, NEW.department_id, NEW.position_id, NEW.employment_type, NEW.employment_status, NEW.hire_date, NEW.manager_id, NEW.work_location, 'Initial employment record');
    IF _uid IS NOT NULL THEN
      INSERT INTO public.audit_logs(admin_id, action, target_type, target_id, details)
      VALUES (_uid, 'employee_created', 'employee', NEW.id, jsonb_build_object('employee_code', NEW.employee_code, 'name', NEW.full_name));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
    INSERT INTO public.employee_timeline(employee_id, event_type, event_title, description, created_by)
    VALUES (NEW.id, 'status_changed', 'Employment Status Changed', coalesce(OLD.employment_status,'—') || ' → ' || NEW.employment_status, _uid);
  END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id OR NEW.position_id IS DISTINCT FROM OLD.position_id
     OR NEW.employment_type IS DISTINCT FROM OLD.employment_type OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
     OR NEW.work_location IS DISTINCT FROM OLD.work_location OR NEW.employment_status IS DISTINCT FROM OLD.employment_status THEN
    UPDATE public.employee_employment SET end_date = current_date
      WHERE employee_id = NEW.id AND end_date IS NULL;
    INSERT INTO public.employee_employment(employee_id, department_id, position_id, employment_type, employment_status, start_date, supervisor_employee_id, work_location)
    VALUES (NEW.id, NEW.department_id, NEW.position_id, NEW.employment_type, NEW.employment_status, current_date, NEW.manager_id, NEW.work_location);
    IF NEW.department_id IS DISTINCT FROM OLD.department_id OR NEW.position_id IS DISTINCT FROM OLD.position_id
       OR NEW.employment_type IS DISTINCT FROM OLD.employment_type OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
       OR NEW.work_location IS DISTINCT FROM OLD.work_location THEN
      INSERT INTO public.employee_timeline(employee_id, event_type, event_title, description, created_by)
      VALUES (NEW.id, 'employment_updated', 'Employment Information Updated', 'Department, position, type, manager or location changed', _uid);
    END IF;
  END IF;
  IF _uid IS NOT NULL AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    INSERT INTO public.audit_logs(admin_id, action, target_type, target_id, details)
    VALUES (_uid, CASE WHEN NEW.employment_status = 'inactive' AND OLD.employment_status <> 'inactive' THEN 'employee_deactivated' ELSE 'employee_updated' END,
      'employee', NEW.id, jsonb_build_object('employee_code', NEW.employee_code));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_employees_before ON public.employees;
CREATE TRIGGER trg_employees_before BEFORE INSERT OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.employees_before_write();
DROP TRIGGER IF EXISTS trg_employees_after ON public.employees;
CREATE TRIGGER trg_employees_after AFTER INSERT OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.employees_after_write();

CREATE OR REPLACE FUNCTION public.hr_org_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _kind text := CASE WHEN TG_TABLE_NAME = 'hr_departments' THEN 'department' ELSE 'position' END;
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.audit_logs(admin_id, action, target_type, target_id, details)
    VALUES (_uid, _kind || CASE WHEN TG_OP = 'INSERT' THEN '_created' ELSE '_updated' END, _kind, NEW.id, to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_hr_departments_audit ON public.hr_departments;
CREATE TRIGGER trg_hr_departments_audit BEFORE INSERT OR UPDATE ON public.hr_departments FOR EACH ROW EXECUTE FUNCTION public.hr_org_audit();
DROP TRIGGER IF EXISTS trg_hr_positions_audit ON public.hr_positions;
CREATE TRIGGER trg_hr_positions_audit BEFORE INSERT OR UPDATE ON public.hr_positions FOR EACH ROW EXECUTE FUNCTION public.hr_org_audit();

REVOKE EXECUTE ON FUNCTION public.next_employee_code() FROM anon, public;