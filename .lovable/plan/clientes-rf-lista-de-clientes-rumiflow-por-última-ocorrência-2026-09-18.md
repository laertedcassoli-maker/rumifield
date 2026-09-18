# Clientes RF — lista de clientes RumiFlow por última ocorrência

Nova tela de leitura listando apenas clientes com RumiFlow ativo, ordenados pela ocorrência mais recente (pedido de peças ou visita técnica).

## O que muda

1. **Menu**: dentro de "Instalações Existentes", o item "Clientes" passa a chamar-se "Clientes RF" e aponta para a nova tela `/clientes-rf`. Mesma permissão de hoje (`instalacoes_clientes`), mesma posição, mesmo ícone.
2. **Nova tela `Clientes RF`**: lista de cartões, um por cliente com RumiFlow ativo, mostrando nome do cliente, fazenda, cidade/UF, a data da última ocorrência e de que tipo ela foi (pedido ou visita).
3. **Ordenação**: da ocorrência mais recente para a mais antiga; clientes sem nenhuma ocorrência aparecem no fim.
4. **Clique**: abre o CRM 360 do cliente (`/crm/:id`).
5. **Busca** por nome/fazenda, no mesmo padrão visual da Carteira CRM.

A Carteira CRM (`/crm/carteira`) continua existindo e funcionando exatamente como hoje. Nenhum outro item de menu muda. Nenhuma gravação de dados.

## Detalhes técnicos

- **Nova página** `src/pages/ClientesRF.tsx`; rota `/clientes-rf` registrada em `src/App.tsx` dentro de `AppLayout`, ao lado de `/visita-tecnica`.
- **Clientes RumiFlow**: reaproveita `useCarteiraData()` de `@/hooks/useCrmData` (já traz `clientes` + `crm_client_products`). Filtro: produtos do cliente com `stage === 'ganho'` e `product_code === 'rumiflow'` — mesma regra de `activeProducts` usada em `CrmCarteira.tsx`, sem alterar aquele arquivo nem o hook.
- **Novo hook** `src/hooks/useClientesRFOcorrencias.ts` (ou queries locais na página) com três consultas em paralelo, no padrão de `useAgendaOperacoes.ts` / `VisitaTecnica.tsx`:
  - `pedidos`: `select('cliente_id, created_at, pedido_code, tipo_solicitacao')`, tipos `envio` e `coleta_reversa`.
  - `ticket_visits`: `select('client_id, planned_start_date, checkout_at, status')`, excluindo canceladas.
  - `preventive_route_items`: `select('client_id, planned_date, checkin_at, status')`, excluindo cancelados.
  - Reduz cada fonte a um mapa `client_id → data mais recente` e combina com `MAX`, guardando também a origem para o rótulo.
- **Ordenação** por essa data desc via `useMemo`, com nulos ao final.
- Formatação de data com `date-fns` + `ptBR`, como nas telas existentes.
- Nenhuma migration, nenhuma mudança de RLS/schema, nenhuma mutação.
