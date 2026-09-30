CREATE POLICY "Public read installation item photos via report" ON storage.objects FOR SELECT TO anon USING (
  bucket_id = 'preventive-media'
  AND (storage.foldername(name))[2] = 'checklist-items'
  AND EXISTS (
    SELECT 1 FROM public.installation_checklist_item_photos p
    WHERE p.photo_path = objects.name
      AND public.is_public_installation_stage(public.installation_stage_of_item(p.item_id))
  )
);