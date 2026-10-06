-- Trigger to auto-register storage objects into public.assets
-- Run this in your Supabase SQL editor (Project SQL). It listens for inserts
-- into storage.objects and writes/updates the public.assets table.

-- Create function
CREATE OR REPLACE FUNCTION public.on_storage_object_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bname text;
  fname text;
  obj_size bigint;
BEGIN
  -- Try to resolve bucket name from storage.buckets
  SELECT name INTO bname FROM storage.buckets WHERE id = NEW.bucket_id LIMIT 1;

  -- filename is the last path segment
  fname := regexp_replace(NEW.name, '^.*/', '');

  -- size field can be named different things depending on version; coalesce common names
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
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_storage_object_created ON storage.objects;
CREATE TRIGGER trg_storage_object_created
AFTER INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.on_storage_object_created();

-- Notes:
-- - This must be run in the Supabase project's SQL editor (it needs the storage schema).
-- - If your storage schema/table names differ, adjust `storage.objects` and `storage.buckets` accordingly.
-- - The trigger is simple and idempotent (uses ON CONFLICT to upsert).
