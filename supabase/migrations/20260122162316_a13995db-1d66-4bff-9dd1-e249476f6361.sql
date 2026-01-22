-- Create warranty_requests table
CREATE TABLE public.warranty_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  motor_code TEXT NOT NULL,
  description TEXT,
  replacement_date TIMESTAMP WITH TIME ZONE NOT NULL,
  hours_used NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  invoice_number TEXT,
  workshop_item_id UUID REFERENCES public.workshop_items(id),
  work_order_id UUID REFERENCES public.work_orders(id),
  motor_replacement_history_id UUID REFERENCES public.motor_replacement_history(id),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment for status values
COMMENT ON COLUMN public.warranty_requests.status IS 'Status: pendente, solicitada, reposta';

-- Enable RLS
ALTER TABLE public.warranty_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read warranty_requests"
  ON public.warranty_requests
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert warranty_requests"
  ON public.warranty_requests
  FOR INSERT
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Admins can update warranty_requests"
  ON public.warranty_requests
  FOR UPDATE
  USING (is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Admins can delete warranty_requests"
  ON public.warranty_requests
  FOR DELETE
  USING (is_admin_or_coordinator(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_warranty_requests_updated_at
  BEFORE UPDATE ON public.warranty_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert default warranty hours config
INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES ('garantia_motor_horas', '400', 'Horas de garantia do motor para criação automática de SG')
ON CONFLICT (chave) DO NOTHING;