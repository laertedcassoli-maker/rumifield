DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-correios-rastreio-diario') THEN
    PERFORM cron.unschedule('sync-correios-rastreio-diario');
  END IF;
END $$;

DELETE FROM vault.secrets WHERE name = 'sync_correios_secret';