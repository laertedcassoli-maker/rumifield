-- Create motor replacement history table
CREATE TABLE public.motor_replacement_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_item_id UUID NOT NULL REFERENCES public.workshop_items(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  replaced_at_meter_hours NUMERIC NOT NULL,
  motor_hours_used NUMERIC NOT NULL,
  replaced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.motor_replacement_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read motor_replacement_history"
ON public.motor_replacement_history
FOR SELECT
USING (true);

CREATE POLICY "Users can insert motor_replacement_history"
ON public.motor_replacement_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_motor_replacement_history_workshop_item 
ON public.motor_replacement_history(workshop_item_id);

-- Add comment for documentation
COMMENT ON TABLE public.motor_replacement_history IS 'Tracks motor replacement history for workshop assets, storing how many hours each motor was used before replacement';