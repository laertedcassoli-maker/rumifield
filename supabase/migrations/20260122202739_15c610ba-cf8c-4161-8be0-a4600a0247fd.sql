
-- 1) Create template-level nonconformities table
CREATE TABLE public.checklist_item_nonconformities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.checklist_template_items(id) ON DELETE CASCADE,
  nonconformity_label TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_item_nonconformities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and coordinators can manage checklist_item_nonconformities"
ON public.checklist_item_nonconformities
FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Authenticated users can read checklist_item_nonconformities"
ON public.checklist_item_nonconformities
FOR SELECT
USING (true);

-- 2) Create execution snapshot table for nonconformities
CREATE TABLE public.preventive_checklist_item_nonconformities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exec_item_id UUID NOT NULL REFERENCES public.preventive_checklist_items(id) ON DELETE CASCADE,
  template_nonconformity_id UUID REFERENCES public.checklist_item_nonconformities(id) ON DELETE SET NULL,
  nonconformity_label_snapshot TEXT NOT NULL,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.preventive_checklist_item_nonconformities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for execution nonconformities
CREATE POLICY "Admins and coordinators can manage preventive_checklist_item_nonconformities"
ON public.preventive_checklist_item_nonconformities
FOR ALL
USING (is_admin_or_coordinator(auth.uid()))
WITH CHECK (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Authenticated users can read preventive_checklist_item_nonconformities"
ON public.preventive_checklist_item_nonconformities
FOR SELECT
USING (true);

CREATE POLICY "Technicians can insert preventive_checklist_item_nonconformities"
ON public.preventive_checklist_item_nonconformities
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM preventive_checklist_items pci
    WHERE pci.id = preventive_checklist_item_nonconformities.exec_item_id
    AND pci.status = 'N'::checklist_item_status
  )
);

CREATE POLICY "Technicians can delete preventive_checklist_item_nonconformities"
ON public.preventive_checklist_item_nonconformities
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM preventive_checklist_items pci
    JOIN preventive_checklist_blocks pcb ON pcb.id = pci.exec_block_id
    JOIN preventive_checklists pc ON pc.id = pcb.checklist_id
    WHERE pci.id = preventive_checklist_item_nonconformities.exec_item_id
    AND pc.status = 'em_andamento'::checklist_execution_status
  )
);

-- Create indexes for performance
CREATE INDEX idx_nonconformities_item_id ON public.checklist_item_nonconformities(item_id);
CREATE INDEX idx_exec_nonconformities_exec_item_id ON public.preventive_checklist_item_nonconformities(exec_item_id);
