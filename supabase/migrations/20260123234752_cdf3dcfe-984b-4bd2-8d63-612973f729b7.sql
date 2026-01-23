-- Fix public policy for preventive-media: file path is userId/preventiveId/filename
DROP POLICY IF EXISTS "Public read preventive media via report token" ON storage.objects;

CREATE POLICY "Public read preventive media via report token"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'preventive-media'
  AND (storage.foldername(name))[2] IN (
    SELECT id::text
    FROM public.preventive_maintenance
    WHERE public_token IS NOT NULL
  )
);