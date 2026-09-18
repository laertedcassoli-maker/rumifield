# Plano: Excluir estoque interno da oficina das telas de Manutenção Preventiva

## Problema

O cliente "PEÇAS OFICINA" (`clientes.estoque_interno = true`, confirmado no banco) é um registro de estoque interno, não uma fazenda real. Hoje ele aparece incorretamente no Calendário Anual, na lista Clientes Preventiva e como opção ao criar nova rota, porque as queries dessas telas filtram só por `status = 'ativo'`.

## Mudanças

### 1. Frontend — 3 arquivos, 1 linha cada

Adicionar `.eq('estoque_interno', false)` junto ao filtro `.eq('status', 'ativo')` já existente:

- `src/pages/preventivas/Calendario.tsx` (query `calendar-clients`, ~linha 77)
- `src/pages/preventivas/Index.tsx` (query `preventive-overview`, ~linha 94)
- `src/pages/preventivas/NovaRota.tsx` (query `clients-for-route`, ~linha 186)

Nenhuma outra condição, select ou ordenação muda.

### 2. Migration — atualizar a view `client_preventive_overview`

Nova migration versionada recriando a view com `WHERE c.status = 'ativo' AND c.estoque_interno = false`. O restante da definição da view (subqueries de `last_preventive_date`, `days_since_last`, `days_until_due`, `preventive_status`) permanece idêntico ao atual. A view é a fonte de verdade documentada da elegibilidade e deve ficar consistente com as telas.

## O que não muda

- A coluna `estoque_interno` e seu uso em `DetalheOSDialog.tsx` / Ordens de Serviço.
- O registro "PEÇAS OFICINA" continua existindo e funcionando em Ordens de Serviço.
- Nenhum outro filtro (status, frequência), tela ou fluxo preventivo.
- RLS, permissões, demais tabelas.

## Validação

- Typecheck (`bunx tsgo --noEmit`) e build.
- Playwright no preview: confirmar que "PEÇAS OFICINA" não aparece no Calendário Anual, em Clientes Preventiva, nem no seletor de clientes da Nova Rota; e que Ordens de Serviço continua exibindo o estoque interno normalmente.

## Detalhes técnicos

- No Supabase PostgREST, `.eq('estoque_interno', false)` exclui também registros nulos? Não — `eq` exige `false` estrito; clientes com `estoque_interno = null` continuam aparecendo, o que é o comportamento desejado (só o `true` é excluído).
- Migration com `CREATE OR REPLACE VIEW public.client_preventive_overview` preserva os grants existentes; verificar após aplicar se os grants/RLS da view permanecem.
