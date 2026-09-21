# Corrigir status da OS OS-2026-00281

## Respostas da investigação

**1. Existe registro de tempo em aberto?** Não. A OS tem 2 apontamentos de tempo, ambos já encerrados:

| Técnico | Início | Fim | Duração |
|---|---|---|---|
| Bruno Oliveira | 20/08/2026 09:52 | 20/08/2026 10:00 | 427s |
| Klyrranie Nascimento | 11/09/2026 10:16 | 11/09/2026 10:16 | 5s |

Nenhum apontamento está em execução ou pausado, então não há a decisão "fechar ou remover" a tomar.

**2. total_time_seconds atual:** 432 segundos (7min12s) — maior que zero.

Situação atual da OS: status `em_manutencao`, início registrado em 20/08/2026, sem data de conclusão.

## Correção a aplicar

Uma única alteração de dados:

```sql
UPDATE work_orders SET status = 'aguardando' WHERE code = 'OS-2026-00281';
```

Nada mais será tocado: `total_time_seconds` (432) permanece, `start_time` e `end_time` da OS permanecem, e os dois apontamentos de tempo ficam intactos.

## Verificação após aplicar

Conferir e reportar:
- novo status da OS (esperado: `aguardando`)
- que nenhum apontamento de tempo ficou em aberto (esperado: os dois seguem encerrados)
