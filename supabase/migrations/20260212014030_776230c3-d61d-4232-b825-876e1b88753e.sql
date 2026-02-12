
ALTER TABLE public.workshop_items
  ADD COLUMN created_by_user_id uuid REFERENCES public.profiles(id),
  ADD COLUMN creation_source text NOT NULL DEFAULT 'manual';
