-- Trigger to register Storage object metadata in public.assets.
-- public.assets is RLS-protected and not directly accessible to anon/authenticated users.
-- The SECURITY DEFINER owner performs the trusted metadata upsert; file access itself
-- remains governed by Supabase Storage policies.

CREATE OR REPLACE FUNCTION public.on_storage_object_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $function$
DECLARE
  bname text;
  fname text;
  obj_size bigint;
BEGIN
  SELECT sb.name INTO bname
  FROM storage.buckets AS sb
  WHERE sb.id = NEW.bucket_id
  LIMIT 1;

  fname := regexp_replace(NEW.name, '^.*/', '');
  obj_size := COALESCE(NEW.size, NEW.bytes, NEW.byte_size, 0);

  INSERT INTO public.assets (bucket, path, filename, content_type, size, metadata, uploaded_at)
  VALUES (
    COALESCE(bname, NEW.bucket_id::text),
    NEW.name,
    fname,
    NEW.content_type,
    obj_size,
    COALESCE(NEW.metadata, '{}'::jsonb),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (bucket, path) DO UPDATE
    SET content_type = EXCLUDED.content_type,
        size = EXCLUDED.size,
        metadata = EXCLUDED.metadata,
        uploaded_at = EXCLUDED.uploaded_at;

  RETURN NEW;
END;
$function$;

-- Trigger execution does not require clients to have EXECUTE permission on the function.
REVOKE ALL ON FUNCTION public.on_storage_object_created() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.on_storage_object_created() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_storage_object_created ON storage.objects;
CREATE TRIGGER trg_storage_object_created
AFTER INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.on_storage_object_created();
