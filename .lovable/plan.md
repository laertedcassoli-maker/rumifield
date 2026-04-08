

## Automatizar sincronização de clientes iMilk

### Problema
A sincronização é 100% manual. Clientes novos no iMilk não aparecem automaticamente no RumiFlow.

### Solução
Criar um cron job que execute a edge function `sync-imilk-clientes` automaticamente a cada **6 horas** (4x por dia). Isso garante que novos clientes apareçam no sistema sem intervenção manual.

### Implementação

**1. Habilitar extensões necessárias (migration)**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

**2. Criar o cron job (via insert tool, pois contém dados específicos do projeto)**
```sql
SELECT cron.schedule(
  'sync-imilk-clientes-auto',
  '0 */6 * * *',  -- a cada 6 horas
  $$
  SELECT net.http_post(
    url := 'https://gperaijwlecreqxoygjy.supabase.co/functions/v1/sync-imilk-clientes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZXJhaWp3bGVjcmVxeG95Z2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTMwODEsImV4cCI6MjA4MDQyOTA4MX0.POQEK-DZ3XOhrusopPFmENAbSsqp-boonj2QjGcd0Xk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Resultado
- Sincronização automática 4x ao dia (00h, 06h, 12h, 18h)
- Novos clientes aparecem em no máximo 6 horas
- O botão manual na tela de admin continua funcionando para sincronizações imediatas
- Sem alteração de código frontend

