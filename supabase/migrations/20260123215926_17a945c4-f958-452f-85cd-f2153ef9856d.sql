-- Create table for preventive visit media
CREATE TABLE public.preventive_visit_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preventive_id UUID NOT NULL REFERENCES public.preventive_maintenance(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.preventive_visit_media ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view media from their own preventives or if admin/coordinator
CREATE POLICY "Users can view preventive media"
ON public.preventive_visit_media
FOR SELECT
USING (
  user_id = auth.uid() OR 
  public.is_admin_or_coordinator(auth.uid())
);

-- Policy: Users can upload their own media
CREATE POLICY "Users can upload preventive media"
ON public.preventive_visit_media
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own media
CREATE POLICY "Users can delete their own media"
ON public.preventive_visit_media
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_preventive_visit_media_preventive ON public.preventive_visit_media(preventive_id);

-- Create storage bucket for preventive media (if not exists - will error gracefully if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('preventive-media', 'preventive-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for preventive-media bucket
CREATE POLICY "Users can upload preventive media files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'preventive-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own preventive media files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'preventive-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all preventive media files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'preventive-media' AND public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Users can delete their own preventive media files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'preventive-media' AND auth.uid()::text = (storage.foldername(name))[1]);