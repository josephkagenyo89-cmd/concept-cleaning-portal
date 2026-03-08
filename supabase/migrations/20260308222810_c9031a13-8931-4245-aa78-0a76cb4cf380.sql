
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Enable realtime for profiles so admin can see status changes live
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
