ALTER TABLE public.installations ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS "Managers can manage installations" ON public.installations;
CREATE POLICY "Managers can select installations" ON public.installations FOR SELECT TO authenticated USING (public.can_manage_installations());
CREATE POLICY "Managers can insert installations" ON public.installations FOR INSERT TO authenticated WITH CHECK (public.can_manage_installations());
CREATE POLICY "Managers can update installations" ON public.installations FOR UPDATE TO authenticated USING (public.can_manage_installations()) WITH CHECK (public.can_manage_installations());
CREATE POLICY "Managers can delete untouched installations" ON public.installations FOR DELETE TO authenticated USING (
  public.can_manage_installations() AND NOT EXISTS (
    SELECT 1 FROM public.installation_stages s WHERE s.installation_id = installations.id AND s.status <> 'planejado'
  )
);