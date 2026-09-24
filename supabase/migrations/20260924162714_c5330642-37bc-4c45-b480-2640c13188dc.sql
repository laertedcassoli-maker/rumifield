CREATE OR REPLACE FUNCTION public.check_sync_omie_rastreio_secret(p_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'sync_omie_rastreio_secret' AND decrypted_secret = p_secret AND coalesce(p_secret,'') <> '');
$$;
REVOKE ALL ON FUNCTION public.check_sync_omie_rastreio_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_sync_omie_rastreio_secret(text) TO service_role;