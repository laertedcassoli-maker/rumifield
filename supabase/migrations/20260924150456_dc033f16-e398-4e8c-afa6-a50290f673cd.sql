INSERT INTO public.configuracoes (chave, valor)
SELECT k, '' FROM (VALUES ('omie_futurecow_app_key'), ('omie_futurecow_app_secret')) v(k)
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes c WHERE c.chave = v.k);