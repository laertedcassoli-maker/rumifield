
-- Step 1: Replace enum entirely using text cast approach
-- First convert columns to text
ALTER TABLE crm_client_products ALTER COLUMN stage DROP DEFAULT;
ALTER TABLE crm_client_products ALTER COLUMN stage TYPE text USING stage::text;
ALTER TABLE crm_visit_product_snapshots ALTER COLUMN stage TYPE text USING stage::text;

-- Migrate data
UPDATE crm_client_products SET stage = 'em_negociacao' WHERE stage IN ('proposta', 'negociacao');
UPDATE crm_client_products SET stage = 'perdido' WHERE stage = 'descartado';
UPDATE crm_visit_product_snapshots SET stage = 'em_negociacao' WHERE stage IN ('proposta', 'negociacao');
UPDATE crm_visit_product_snapshots SET stage = 'perdido' WHERE stage = 'descartado';

-- Drop old enum and create new one
DROP TYPE crm_stage;
CREATE TYPE crm_stage AS ENUM ('nao_qualificado', 'qualificado', 'em_negociacao', 'ganho', 'perdido');

-- Convert back to enum
ALTER TABLE crm_client_products ALTER COLUMN stage TYPE crm_stage USING stage::crm_stage;
ALTER TABLE crm_client_products ALTER COLUMN stage SET DEFAULT 'nao_qualificado';
ALTER TABLE crm_visit_product_snapshots ALTER COLUMN stage TYPE crm_stage USING stage::crm_stage;
