
-- Table for ticket tag definitions (managed by admin)
CREATE TABLE public.ticket_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction table linking tags to tickets
CREATE TABLE public.ticket_tag_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.technical_tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.ticket_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tag_links ENABLE ROW LEVEL SECURITY;

-- ticket_tags: readable by all authenticated, writable by admins
CREATE POLICY "Authenticated users can read ticket_tags"
  ON public.ticket_tags FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage ticket_tags"
  ON public.ticket_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ticket_tag_links: readable by all authenticated, insertable/deletable by authenticated
CREATE POLICY "Authenticated users can read ticket_tag_links"
  ON public.ticket_tag_links FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert ticket_tag_links"
  ON public.ticket_tag_links FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete ticket_tag_links"
  ON public.ticket_tag_links FOR DELETE
  USING (auth.role() = 'authenticated');

-- Index for faster lookups
CREATE INDEX idx_ticket_tag_links_ticket_id ON public.ticket_tag_links(ticket_id);
CREATE INDEX idx_ticket_tag_links_tag_id ON public.ticket_tag_links(tag_id);
