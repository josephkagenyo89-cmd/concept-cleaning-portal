-- Keep validation rule JSON explicit and compatible with the question answer type.
ALTER TABLE public.booking_engine_question_templates
  ADD CONSTRAINT booking_engine_question_templates_validation_rules_supported
  CHECK (
    (validation_rules - ARRAY['min','max','min_length','max_length','pattern']) = '{}'::jsonb
    AND (NOT validation_rules ? 'min' OR (input_type IN ('number','measurement') AND jsonb_typeof(validation_rules->'min')='number'))
    AND (NOT validation_rules ? 'max' OR (input_type IN ('number','measurement') AND jsonb_typeof(validation_rules->'max')='number'))
    AND (NOT validation_rules ? 'min_length' OR (input_type IN ('text','textarea','date','time','address') AND jsonb_typeof(validation_rules->'min_length')='number' AND (validation_rules->>'min_length')::numeric >= 0 AND trunc((validation_rules->>'min_length')::numeric)=(validation_rules->>'min_length')::numeric))
    AND (NOT validation_rules ? 'max_length' OR (input_type IN ('text','textarea','date','time','address') AND jsonb_typeof(validation_rules->'max_length')='number' AND (validation_rules->>'max_length')::numeric >= 0 AND trunc((validation_rules->>'max_length')::numeric)=(validation_rules->>'max_length')::numeric))
    AND (NOT validation_rules ? 'pattern' OR (input_type IN ('text','textarea','date','time','address') AND jsonb_typeof(validation_rules->'pattern')='string'))
    AND (NOT (validation_rules ? 'min' AND validation_rules ? 'max') OR (validation_rules->>'min')::numeric <= (validation_rules->>'max')::numeric)
    AND (NOT (validation_rules ? 'min_length' AND validation_rules ? 'max_length') OR (validation_rules->>'min_length')::numeric <= (validation_rules->>'max_length')::numeric)
  );

ALTER TABLE public.booking_engine_questions
  ADD CONSTRAINT booking_engine_questions_validation_rules_supported
  CHECK (
    (validation_rules - ARRAY['min','max','min_length','max_length','pattern']) = '{}'::jsonb
    AND (NOT validation_rules ? 'min' OR (input_type IN ('number','measurement') AND jsonb_typeof(validation_rules->'min')='number'))
    AND (NOT validation_rules ? 'max' OR (input_type IN ('number','measurement') AND jsonb_typeof(validation_rules->'max')='number'))
    AND (NOT validation_rules ? 'min_length' OR (input_type IN ('text','textarea','date','time','address') AND jsonb_typeof(validation_rules->'min_length')='number' AND (validation_rules->>'min_length')::numeric >= 0 AND trunc((validation_rules->>'min_length')::numeric)=(validation_rules->>'min_length')::numeric))
    AND (NOT validation_rules ? 'max_length' OR (input_type IN ('text','textarea','date','time','address') AND jsonb_typeof(validation_rules->'max_length')='number' AND (validation_rules->>'max_length')::numeric >= 0 AND trunc((validation_rules->>'max_length')::numeric)=(validation_rules->>'max_length')::numeric))
    AND (NOT validation_rules ? 'pattern' OR (input_type IN ('text','textarea','date','time','address') AND jsonb_typeof(validation_rules->'pattern')='string'))
    AND (NOT (validation_rules ? 'min' AND validation_rules ? 'max') OR (validation_rules->>'min')::numeric <= (validation_rules->>'max')::numeric)
    AND (NOT (validation_rules ? 'min_length' AND validation_rules ? 'max_length') OR (validation_rules->>'min_length')::numeric <= (validation_rules->>'max_length')::numeric)
  );
