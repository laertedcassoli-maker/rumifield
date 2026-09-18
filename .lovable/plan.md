# Clientes RF — base de clientes e nova tela de detalhe

A lista passa a usar a mesma base de Administração > Clientes e o clique abre uma tela de leitura própria, sem nada de CRM.

## O que muda

1. **Lista "Clientes RF"**: deixa de depender do funil do CRM. Passa a trazer os clientes ativos cadastrados em Clientes, excluindo os registros internos de estoque. Ordenação pela ocorrência mais recente, badge do tipo e busca por nome/fazenda continuam iguais.
2. **Clique no cartão**: abre `/clientes-rf/:id` em vez do CRM 360.
3. **Nova tela de detalhe (somente leitura)**:
   - Cabeçalho: nome, fazenda, cidade/UF.
   - **Serviços Técnicos**: reaproveita o histórico técnico existente (chamados, preventivas, corretivas) exatamente como já funciona hoje.
   - **Envios/Coleta Reversa**: histórico dos últimos 20 pedidos do cliente, com código do pedido, tipo (Envio / Coleta Reversa), situação, data e, quando houver, código de rastreio/postagem.
   - Nenhum botão de criar, editar, processar ou excluir; nenhum dado de produto, funil ou comercial.

A Carteira CRM, o CRM 360 (`/crm/:id`), Administração > Clientes e o menu continuam exatamente como estão. Nenhum item novo de menu.

## Detalhes técnicos

- `src/pages/ClientesRF.tsx`: remove `useCarteiraData()`/filtro `stage === 'ganho' && product_code === 'rumiflow'`; nova `useQuery` em `clientes` com `select('id, nome, fazenda, cidade, estado, status')`, `.eq('estoque_interno', false)` e `.eq('status', 'ativo')`. Mantém sem alteração as três queries de ocorrência (`pedidos` envio/coleta_reversa, `ticket_visits`, `preventive_route_items`), o filtro de cancelados em JS, o mapa `client_id → melhor(data, origem)`, a ordenação desc com nulos ao fim e a busca. `navigate('/clientes-rf/' + c.id)`.
- Novo `src/pages/ClientesRFDetalhe.tsx`: `useParams()`, query do cliente por `id`, `<ClienteHistoricoTab clientId={id} />` sem props novas, e query `pedidos` → `select('id, pedido_code, tipo_solicitacao, status, created_at, codigo_rastreio, codigo_postagem')`, `.eq('cliente_id', id)`, `order('created_at', { ascending: false })`, `limit(20)`. Cards/Badges do design system, `date-fns` + `ptBR`.
- `src/App.tsx`: rota `/clientes-rf/:id` dentro de `AppLayout`, com a mesma proteção de sessão das demais.
- Sem migration, sem mudança de RLS/schema, sem mutações. `useCrmData.ts`, `ClienteHistoricoTab.tsx`, `CrmCliente360.tsx`, `/admin/clientes` e a Sidebar ficam intocados.
