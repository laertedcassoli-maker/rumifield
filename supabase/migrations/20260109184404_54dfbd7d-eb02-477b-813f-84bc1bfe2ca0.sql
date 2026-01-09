-- Add 'rascunho' to pedido_status enum
ALTER TYPE pedido_status ADD VALUE IF NOT EXISTS 'rascunho' BEFORE 'solicitado';