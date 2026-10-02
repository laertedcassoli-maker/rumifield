DELETE FROM public.installation_checklist_item_photos a USING public.installation_checklist_item_photos b
 WHERE a.item_id = b.item_id AND a.photo_path = b.photo_path AND (a.created_at, a.id::text) > (b.created_at, b.id::text);
DELETE FROM public.preventive_checklist_item_photos a USING public.preventive_checklist_item_photos b
 WHERE a.item_id = b.item_id AND a.photo_path = b.photo_path AND (a.created_at, a.id::text) > (b.created_at, b.id::text);
ALTER TABLE public.installation_checklist_item_photos ADD CONSTRAINT installation_checklist_item_photos_item_path_key UNIQUE (item_id, photo_path);
ALTER TABLE public.preventive_checklist_item_photos ADD CONSTRAINT preventive_checklist_item_photos_item_path_key UNIQUE (item_id, photo_path);