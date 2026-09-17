# Minhas Pendências (Fase 7)

Nova tela pessoal, somente leitura, que reúne em um só lugar tudo o que está em aberto para o usuário logado, em quatro blocos: Preventivas, Visitas Técnicas, Coleta Reversa e Envios. Cada item leva à tela onde o trabalho é feito. Nada é criado, alterado ou concluído a partir dessa tela.

## O que o usuário vai ver

- Novo item "Minhas Pendências" no topo do Menu Principal, visível para qualquer usuário autenticado, com um contador (badge) da soma total de pendências.
- A tela mostra as quatro seções sempre, cada uma com contagem no título; quando não há nada, a seção exibe uma mensagem clara ("Nenhuma pendência em Preventivas", etc.) — comportamento igual nas quatro.
- Cada linha mostra código, cliente e data, e um botão "Abrir" que navega para o registro de origem.

## Regras de "pendente" por domínio (confirmadas no banco)

- Preventivas: itens de rota (`preventive_route_items`) com status `planejado` ou `reagendado`, cuja rota (`preventive_routes.field_technician_user_id`) é do usuário e cujo status é `planejada` ou `em_execucao`. Abre em `/preventivas/execucao/{route_id}`.
- Visitas técnicas: `ticket_visits` com `field_technician_user_id` do usuário e status `em_elaboracao`, `planejada` ou `em_execucao`. Abre em `/chamados/visita/{id}`.
- Coleta Reversa: `pedidos` com `tipo_solicitacao='coleta_reversa'`, `status='pendente'` e responsável = usuário (técnico, CSM, ou solicitante quando `tipo_coleta='correios'`) — mesma regra já usada hoje. Abre em `/pedidos?tipo=coleta_reversa`.
- Envios: `pedidos` com `tipo_solicitacao='envio'`, `tecnico_responsavel_user_id` do usuário e status fora de `faturado`, `enviado`, `entregue` (e não cancelado/rascunho de terceiros). Abre em `/pedidos?tipo=envio`.

## Detalhes técnicos

- Novo hook `src/hooks/useMinhasPendencias.ts` com quatro consultas React Query independentes, seguindo os padrões já validados:
  - `['my-preventive-routes', 'pendencias', userId]`
  - `['my-corrective-visits', 'pendencias', userId]`
  - `['pedidos', 'pendencias-coleta', userId]`
  - `['pedidos', 'pendencias-envio', userId]`
  Os prefixos `pedidos` / `my-preventive-routes` / `my-corrective-visits` fazem o contador atualizar junto com as invalidações já existentes de cada módulo. Enriquecimento de cliente/código feito com consultas auxiliares em `clientes`, `technical_tickets` e `profiles`, como em `MinhasRotas.tsx`.
- Nova página `src/pages/MinhasPendencias.tsx` (cards por seção, `Badge` de status, botão de navegação) e rota `/minhas-pendencias` dentro do `AppLayout` em `src/App.tsx`, protegida pelo permKey `minhas_pendencias`.
- `src/components/layout/AppSidebar.tsx`: item no topo do Menu Principal (ícone `ListTodo`), com badge somando os quatro totais. O contador existente no submenu "Coleta Reversa" permanece intacto.
- Nova migration: seed de `role_menu_permissions` para `menu_key='minhas_pendencias'` (grupo do Menu Principal), `can_access=true` para todas as roles do enum `app_role`, com `ON CONFLICT (role, menu_key) DO UPDATE`.
- Sem novas tabelas, colunas, policies ou mutações; toda leitura passa pela RLS já existente de cada tabela.

## Fora do escopo

- Nenhuma alteração nas telas de Preventivas, Chamados/Visitas ou Solicitação de Peças (inclusive a aba "Pendentes" e seu contador).
- Sem notificação push e sem tabela de pendências.
