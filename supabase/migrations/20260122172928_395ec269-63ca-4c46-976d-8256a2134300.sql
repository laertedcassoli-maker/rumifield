-- Add foreign key from motor_replacement_history.user_id to profiles.id
ALTER TABLE public.motor_replacement_history
ADD CONSTRAINT motor_replacement_history_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);