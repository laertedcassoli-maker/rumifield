-- Create ticket categories table
CREATE TABLE public.ticket_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  icon TEXT DEFAULT 'tag',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies - anyone authenticated can read, only admins can modify
CREATE POLICY "Anyone can view active categories" 
ON public.ticket_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can insert categories" 
ON public.ticket_categories 
FOR INSERT 
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Only admins can update categories" 
ON public.ticket_categories 
FOR UPDATE 
USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Only admins can delete categories" 
ON public.ticket_categories 
FOR DELETE 
USING (is_admin_or_coordinator(auth.uid()));

-- Add products and category columns to technical_tickets
ALTER TABLE public.technical_tickets 
ADD COLUMN products TEXT[] DEFAULT '{}',
ADD COLUMN category_id UUID REFERENCES public.ticket_categories(id);

-- Insert default categories
INSERT INTO public.ticket_categories (name, color, icon, order_index) VALUES
('Instalação', '#3b82f6', 'package-plus', 1),
('Manutenção', '#f59e0b', 'wrench', 2),
('Dúvida Técnica', '#8b5cf6', 'help-circle', 3),
('Treinamento', '#10b981', 'graduation-cap', 4);