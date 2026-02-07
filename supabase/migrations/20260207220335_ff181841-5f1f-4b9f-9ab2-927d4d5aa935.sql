
-- Create table for CRM visit audios
CREATE TABLE public.crm_visit_audios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id uuid NOT NULL REFERENCES public.crm_visits(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  storage_path text,
  file_size_bytes integer,
  duration_seconds integer,
  transcription text,
  summary text[],
  status text NOT NULL DEFAULT 'pending_upload',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_visit_audios ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own audios
CREATE POLICY "Users can view own audios"
  ON public.crm_visit_audios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audios"
  ON public.crm_visit_audios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audios"
  ON public.crm_visit_audios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own audios"
  ON public.crm_visit_audios FOR DELETE
  USING (auth.uid() = user_id);

-- Admins/coordinators can view all
CREATE POLICY "Admins can view all audios"
  ON public.crm_visit_audios FOR SELECT
  USING (public.is_admin_or_coordinator(auth.uid()));

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-visit-audios', 'crm-visit-audios', false);

-- Storage policies
CREATE POLICY "Users can upload visit audios"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'crm-visit-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own visit audios"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'crm-visit-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own visit audios"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'crm-visit-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can read all visit audios
CREATE POLICY "Admins can read all visit audios"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'crm-visit-audios' AND public.is_admin_or_coordinator(auth.uid()));
