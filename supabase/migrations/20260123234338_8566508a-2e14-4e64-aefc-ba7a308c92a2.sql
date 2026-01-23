-- Allow public read access to profiles for public report (technician name)
CREATE POLICY "Public read profiles via preventive report" 
ON public.profiles 
FOR SELECT 
USING (
  id IN (
    SELECT field_technician_user_id FROM public.preventive_routes 
    WHERE id IN (
      SELECT route_id FROM public.preventive_maintenance 
      WHERE public_token IS NOT NULL
    )
  )
);

-- Allow public read access to preventive_routes for public report
CREATE POLICY "Public read routes via preventive report" 
ON public.preventive_routes 
FOR SELECT 
USING (
  id IN (
    SELECT route_id FROM public.preventive_maintenance 
    WHERE public_token IS NOT NULL
  )
);

-- Allow public read access to preventive_route_items for public report
CREATE POLICY "Public read route items via preventive report" 
ON public.preventive_route_items 
FOR SELECT 
USING (
  route_id IN (
    SELECT route_id FROM public.preventive_maintenance 
    WHERE public_token IS NOT NULL
  )
);

-- Allow public read access to preventive media files for public report
CREATE POLICY "Public read preventive media via report token"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'preventive-media' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.preventive_maintenance 
    WHERE public_token IS NOT NULL
  )
);