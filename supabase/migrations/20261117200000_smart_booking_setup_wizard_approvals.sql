-- Persistent, sequential approvals for the Smart Booking setup wizard.
-- Approvals are snapshots of actual service configuration. Changes to an approved
-- step make that step (and all later steps) require review again.

CREATE TABLE IF NOT EXISTS public.booking_engine_setup_step_approvals (
  service_config_id uuid NOT NULL REFERENCES public.booking_engine_service_config(id) ON DELETE CASCADE,
  step_key text NOT NULL CHECK (step_key IN ('instructions','questions','pricing','scope','offers','final_review')),
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  snapshot_hash text NOT NULL,
  skipped boolean NOT NULL DEFAULT false,
  PRIMARY KEY (service_config_id, step_key)
);

ALTER TABLE public.booking_engine_setup_step_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_engine_setup_step_approvals FROM anon, authenticated;
GRANT SELECT ON public.booking_engine_setup_step_approvals TO authenticated;

DROP POLICY IF EXISTS booking_engine_admin_read_setup_approvals ON public.booking_engine_setup_step_approvals;
CREATE POLICY booking_engine_admin_read_setup_approvals
  ON public.booking_engine_setup_step_approvals
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.booking_engine_setup_step_fingerprint(
  _service_config_id uuid,
  _step_key text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_config public.booking_engine_service_config%ROWTYPE;
  v_payload jsonb;
  v_service_id uuid;
BEGIN
  SELECT * INTO v_config
  FROM public.booking_engine_service_config
  WHERE id = _service_config_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Smart Booking service configuration not found';
  END IF;

  SELECT service_id INTO v_service_id
  FROM public.booking_engine_service_config
  WHERE id = _service_config_id;

  CASE _step_key
    WHEN 'instructions' THEN
      v_payload := jsonb_build_object(
        'service_id', v_config.service_id,
        'customer_instructions', v_config.customer_instructions,
        'photo_mode', v_config.photo_mode,
        'photo_min', v_config.photo_min,
        'photo_max', v_config.photo_max,
        'measurement_config', v_config.measurement_config,
        'availability_config', v_config.availability_config
      );
    WHEN 'questions' THEN
      v_payload := jsonb_build_object(
        'questions', COALESCE((
          SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order, q.id)
          FROM public.booking_engine_questions q
          WHERE q.service_config_id = _service_config_id
        ), '[]'::jsonb),
        'conditions', COALESCE((
          SELECT jsonb_agg(to_jsonb(c) ORDER BY c.question_id, c.created_at, c.id)
          FROM public.booking_engine_question_conditions c
          JOIN public.booking_engine_questions q ON q.id = c.question_id
          WHERE q.service_config_id = _service_config_id
        ), '[]'::jsonb)
      );
    WHEN 'pricing' THEN
      v_payload := COALESCE((
        SELECT jsonb_agg(to_jsonb(p) ORDER BY p.version, p.id)
        FROM public.booking_engine_pricing_rules p
        WHERE p.service_config_id = _service_config_id
      ), '[]'::jsonb);
    WHEN 'scope' THEN
      v_payload := COALESCE((
        SELECT jsonb_agg(to_jsonb(s) ORDER BY s.display_order, s.id)
        FROM public.booking_engine_service_scope s
        WHERE s.service_config_id = _service_config_id
      ), '[]'::jsonb);
    WHEN 'offers' THEN
      v_payload := COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('offer', to_jsonb(o), 'service_link', to_jsonb(os))
          ORDER BY o.display_order, o.id, os.relationship, os.id
        )
        FROM public.booking_engine_value_offer_services os
        JOIN public.booking_engine_value_offers o ON o.id = os.offer_id
        WHERE os.service_id = v_service_id
      ), '[]'::jsonb);
    WHEN 'final_review' THEN
      v_payload := jsonb_build_object(
        'instructions', public.booking_engine_setup_step_fingerprint(_service_config_id, 'instructions'),
        'questions', public.booking_engine_setup_step_fingerprint(_service_config_id, 'questions'),
        'pricing', public.booking_engine_setup_step_fingerprint(_service_config_id, 'pricing'),
        'scope', public.booking_engine_setup_step_fingerprint(_service_config_id, 'scope'),
        'offers', public.booking_engine_setup_step_fingerprint(_service_config_id, 'offers')
      );
    ELSE
      RAISE EXCEPTION 'Unknown Smart Booking setup step: %', _step_key;
  END CASE;

  RETURN md5(v_payload::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_booking_engine_setup_progress(_service_config_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_keys text[] := ARRAY['instructions','questions','pricing','scope','offers','final_review'];
  v_titles text[] := ARRAY[
    'Service instructions & requirements',
    'Customer questions',
    'Booking price method',
    'Included service scope',
    'Packages & value offers',
    'Final review'
  ];
  v_steps jsonb := '[]'::jsonb;
  v_key text;
  v_index integer;
  v_hash text;
  v_saved_hash text;
  v_approved_by uuid;
  v_approved_at timestamptz;
  v_skipped boolean;
  v_has_row boolean;
  v_prior_valid boolean := true;
  v_valid boolean;
  v_next text := NULL;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may view setup approvals';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.booking_engine_service_config WHERE id = _service_config_id) THEN
    RAISE EXCEPTION 'Smart Booking service configuration not found';
  END IF;

  FOREACH v_key IN ARRAY v_keys LOOP
    v_index := array_position(v_keys, v_key);
    v_hash := public.booking_engine_setup_step_fingerprint(_service_config_id, v_key);
    SELECT a.snapshot_hash, a.approved_by, a.approved_at, a.skipped
      INTO v_saved_hash, v_approved_by, v_approved_at, v_skipped
    FROM public.booking_engine_setup_step_approvals a
    WHERE a.service_config_id = _service_config_id AND a.step_key = v_key;
    v_has_row := FOUND;
    v_valid := v_prior_valid AND v_has_row AND v_saved_hash = v_hash;

    IF NOT v_valid AND v_next IS NULL THEN
      v_next := v_key;
    END IF;

    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'key', v_key,
      'title', v_titles[v_index],
      'approved', COALESCE(v_valid, false),
      'current', v_key = v_next,
      'skipped', CASE WHEN v_valid THEN COALESCE(v_skipped, false) ELSE false END,
      'approved_by', CASE WHEN v_valid THEN v_approved_by ELSE NULL END,
      'approved_at', CASE WHEN v_valid THEN v_approved_at ELSE NULL END
    ));

    v_prior_valid := v_valid;
  END LOOP;

  RETURN jsonb_build_object(
    'service_config_id', _service_config_id,
    'steps', v_steps,
    'next_step', v_next,
    'complete', v_next IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_booking_engine_setup_step(
  _service_config_id uuid,
  _step_key text,
  _skip_optional boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_keys text[] := ARRAY['instructions','questions','pricing','scope','offers','final_review'];
  v_order integer;
  v_previous text;
  v_saved_hash text;
  v_hash text;
  v_config public.booking_engine_service_config%ROWTYPE;
  v_service_id uuid;
  v_count integer;
  v_skipped boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may approve setup steps';
  END IF;

  v_order := array_position(v_keys, _step_key);
  IF v_order IS NULL THEN RAISE EXCEPTION 'Unknown Smart Booking setup step'; END IF;

  SELECT * INTO v_config
  FROM public.booking_engine_service_config
  WHERE id = _service_config_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Smart Booking service configuration not found'; END IF;
  v_service_id := v_config.service_id;

  IF v_order > 1 THEN
    FOR i IN 1..(v_order - 1) LOOP
      v_previous := v_keys[i];
      SELECT snapshot_hash INTO v_saved_hash
      FROM public.booking_engine_setup_step_approvals
      WHERE service_config_id = _service_config_id AND step_key = v_previous;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Complete and approve the previous setup step first: %', v_previous;
      END IF;
      v_hash := public.booking_engine_setup_step_fingerprint(_service_config_id, v_previous);
      IF v_saved_hash IS DISTINCT FROM v_hash THEN
        RAISE EXCEPTION 'The earlier setup step "%" has changed. Review and approve it again first.', v_previous;
      END IF;
    END LOOP;
  END IF;

  CASE _step_key
    WHEN 'questions' THEN
      SELECT count(*) INTO v_count
      FROM public.booking_engine_questions
      WHERE service_config_id = _service_config_id AND active = true;
      IF v_count = 0 THEN RAISE EXCEPTION 'Add at least one active customer question before approving this step'; END IF;
    WHEN 'pricing' THEN
      SELECT count(*) INTO v_count
      FROM public.booking_engine_pricing_rules
      WHERE service_config_id = _service_config_id AND active = true;
      IF v_count = 0 THEN RAISE EXCEPTION 'Add at least one active pricing rule before approving this step'; END IF;
    WHEN 'scope' THEN
      SELECT count(*) INTO v_count
      FROM public.booking_engine_service_scope
      WHERE service_config_id = _service_config_id AND active = true AND scope_type = 'included';
      IF v_count = 0 THEN RAISE EXCEPTION 'Add at least one active included-scope item before approving this step'; END IF;
    WHEN 'offers' THEN
      IF _skip_optional THEN
        SELECT count(*) INTO v_count
        FROM public.booking_engine_value_offer_services
        WHERE service_id = v_service_id;
        IF v_count > 0 THEN
          RAISE EXCEPTION 'This service already has offer mappings. Review the offers and approve this step instead of skipping it.';
        END IF;
        v_skipped := true;
      END IF;
    WHEN 'final_review' THEN
      IF v_config.photo_mode = 'required' THEN
        RAISE EXCEPTION 'Required photo upload is not supported. Change photo mode to optional or none before final review.';
      END IF;
      SELECT count(*) INTO v_count
      FROM public.booking_engine_pricing_rules
      WHERE service_config_id = _service_config_id AND active = true;
      IF v_count = 0 THEN RAISE EXCEPTION 'Final review requires at least one active pricing rule'; END IF;
      SELECT count(*) INTO v_count
      FROM public.booking_engine_service_scope
      WHERE service_config_id = _service_config_id AND active = true AND scope_type = 'included';
      IF v_count = 0 THEN RAISE EXCEPTION 'Final review requires at least one active included-scope item'; END IF;
    ELSE
      NULL;
  END CASE;

  v_hash := public.booking_engine_setup_step_fingerprint(_service_config_id, _step_key);
  INSERT INTO public.booking_engine_setup_step_approvals
    (service_config_id, step_key, approved_by, approved_at, snapshot_hash, skipped)
  VALUES
    (_service_config_id, _step_key, auth.uid(), now(), v_hash, v_skipped)
  ON CONFLICT (service_config_id, step_key) DO UPDATE
    SET approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        snapshot_hash = EXCLUDED.snapshot_hash,
        skipped = EXCLUDED.skipped;

  RETURN public.get_booking_engine_setup_progress(_service_config_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.booking_engine_require_setup_approvals_before_enable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_key text;
  v_saved_hash text;
  v_hash text;
  v_keys text[] := ARRAY['instructions','questions','pricing','scope','offers','final_review'];
BEGIN
  IF NEW.enabled IS TRUE AND OLD.enabled IS DISTINCT FROM TRUE THEN
    -- Do not allow configuration fields and enabled=true to be changed in one
    -- statement; fingerprints are checked against the persisted configuration.
    IF NEW.customer_instructions IS DISTINCT FROM OLD.customer_instructions
       OR NEW.photo_mode IS DISTINCT FROM OLD.photo_mode
       OR NEW.photo_min IS DISTINCT FROM OLD.photo_min
       OR NEW.photo_max IS DISTINCT FROM OLD.photo_max
       OR NEW.measurement_config IS DISTINCT FROM OLD.measurement_config
       OR NEW.availability_config IS DISTINCT FROM OLD.availability_config THEN
      RAISE EXCEPTION 'Save configuration changes first, then review and approve the affected setup steps before enabling.';
    END IF;
    IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
      RAISE EXCEPTION 'Only admins and super admins may enable a Smart Booking service';
    END IF;

    FOREACH v_key IN ARRAY v_keys LOOP
      SELECT snapshot_hash INTO v_saved_hash
      FROM public.booking_engine_setup_step_approvals
      WHERE service_config_id = NEW.id AND step_key = v_key;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Smart Booking setup step "%" must be approved before enabling this service', v_key;
      END IF;
      v_hash := public.booking_engine_setup_step_fingerprint(NEW.id, v_key);
      IF v_saved_hash IS DISTINCT FROM v_hash THEN
        RAISE EXCEPTION 'Smart Booking setup step "%" changed after approval. Review it again before enabling.', v_key;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS booking_engine_require_setup_approvals_before_enable
  ON public.booking_engine_service_config;
CREATE TRIGGER booking_engine_require_setup_approvals_before_enable
  BEFORE UPDATE OF enabled ON public.booking_engine_service_config
  FOR EACH ROW
  EXECUTE FUNCTION public.booking_engine_require_setup_approvals_before_enable();

REVOKE ALL ON FUNCTION public.booking_engine_setup_step_fingerprint(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_booking_engine_setup_progress(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_booking_engine_setup_step(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booking_engine_require_setup_approvals_before_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_engine_setup_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_booking_engine_setup_step(uuid, text, boolean) TO authenticated;
