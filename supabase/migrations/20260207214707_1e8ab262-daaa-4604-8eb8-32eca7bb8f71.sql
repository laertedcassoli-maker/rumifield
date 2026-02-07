ALTER TABLE public.crm_visits
ADD CONSTRAINT crm_visits_owner_user_id_fkey
FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id);