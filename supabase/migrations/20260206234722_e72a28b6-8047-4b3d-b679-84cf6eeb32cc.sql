ALTER TABLE public.crm_product_qualification_items
ADD COLUMN choice_options text[] DEFAULT '{}';

COMMENT ON COLUMN public.crm_product_qualification_items.choice_options IS 'Predefined options for choice/list answer types';