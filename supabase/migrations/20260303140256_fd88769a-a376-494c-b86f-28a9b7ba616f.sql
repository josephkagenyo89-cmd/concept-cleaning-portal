ALTER TABLE public.notices
  ADD COLUMN link_url text DEFAULT NULL,
  ADD COLUMN link_label text DEFAULT NULL,
  ADD COLUMN open_in_new_tab boolean NOT NULL DEFAULT true;