ALTER TABLE public.work_order_items ADD COLUMN IF NOT EXISTS meter_damaged boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.work_order_items.meter_damaged IS 'Marca a OS cuja leitura de horimetro foi feita com o horimetro danificado (leitura registrada como 0, sem valor confiavel).';

ALTER TABLE public.asset_meter_readings ADD COLUMN IF NOT EXISTS meter_damaged boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.asset_meter_readings.meter_damaged IS 'Leitura feita com horimetro danificado: reading_value = 0 nao representa horas reais.';

ALTER TABLE public.motor_replacement_history ALTER COLUMN motor_hours_used DROP NOT NULL;
ALTER TABLE public.motor_replacement_history ADD COLUMN IF NOT EXISTS motor_hours_unknown boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.motor_replacement_history.motor_hours_unknown IS 'Horas de uso do motor retirado desconhecidas (horimetro danificado). Quando true, motor_hours_used fica nulo e o ciclo e ignorado em medias de vida util.';