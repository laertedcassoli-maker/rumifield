# Instalações — Fase de Execução (schema complementar + UI + motor de checklist)

## Contexto
- Schema base já aplicado: `installations`, `installation_stages`, `installation_checklists` (FKs a `installation_stages`/`checklist_templates`, nunca a `preventive_maintenance`).
- Motor preventivo (`ChecklistExecution.tsx`) é 100% acoplado a `preventive_checklists`/`preventive_part_consumption` — não será generalizado; o fluxo preventivo e o proxy `preventive_maintenance` usado por visitas corretivas ficam intactos.
- Decisões confirmadas: menu = item próprio no Menu Principal; gestão = admin/coordenador_rplus/consultor_rplus/coordenador_servicos; tecnico_campo só executa a própria etapa atribuída (padrão "Minhas Rotas"); execução completa (não conformidades, ações, peças consumidas, auto-consumo "Troca"); execução com suporte offline (Dexie + syncQueue, write-local-first como no motor preventivo); instalação criada manualmente na nova tela.

## Fase 1 — Migration (mirror das tabelas de execução + peças)

Novas tabelas espelhando as de execução preventiva, apontando para `installation_checklists`:

1. `installation_checklist_blocks` — `checklist_id` FK → `installation_checklists` (CASCADE), `template_block_id` FK → `checklist_template_blocks`, `block_name_snapshot`, `order_index`.
2. `installation_checklist_items` — `exec_block_id` FK → `installation_checklist_blocks` (CASCADE), `template_item_id` FK → `checklist_template_items`, `item_name_snapshot`, `order_index`, `status` (checklist_item_status), `notes`, `answered_at`.
3. `installation_checklist_item_actions` — `exec_item_id` FK → itens, `template_action_id` FK → `checklist_item_corrective_actions`, `action_label_snapshot`, `selected_at`.
4. `installation_checklist_item_nonconformities` — `exec_item_id` FK → itens, `template_nonconformity_id` FK → `checklist_item_nonconformities`, `nonconformity_label_snapshot`, `selected_at`.
5. `installation_part_consumption` — espelho de `preventive_part_consumption` com `installation_stage_id` FK → `installation_stages` (CASCADE) no lugar de `preventive_id`; `part_id` → `pecas`, `exec_item_id`, `exec_nonconformity_id`, snapshots, `quantity`, `is_manual`, `stock_source`, `unit_cost_snapshot`, `asset_unique_code`, `consumed_at`.
   - Nota: não toca em estoque/`estoque_cliente` nem em lógica de pedidos nesta fase.

RLS/GRANTs (todas as tabelas novas + revisão das 3 existentes):
- Leitura: `authenticated` (`USING (true)`), como já praticado nas tabelas operacionais.
- Escrita de gestão: nova função security definer `can_manage_installations()` = `is_admin_or_coordinator() OR has_role('consultor_rplus')` — evita recursão de RLS. Aplicada a `installations`/`installation_stages` (substitui as policies atuais só de admin/coordenador).
- Escrita de execução: técnico designado da etapa (`installation_stages.technician_user_id = auth.uid()` via join) pode criar/atualizar a execução de checklist e itens/consumos da própria etapa; gestão também pode.
- `GRANT SELECT/INSERT/UPDATE/DELETE` para `authenticated` conforme policies + `GRANT ALL` para `service_role`.
- Regenerar `types.ts`.

## Fase 2 — Menu e tela de Instalações

- `AppSidebar.tsx`: item "Instalações" (ícone lucide-react) no Menu Principal, com permKey `instalacoes`; submenu existente "Instalações Existentes" não é alterado.
- Migration de seed: `role_menu_permissions` para `menu_key='instalacoes'` (grupo `principal`), `can_access=true` para admin, coordenador_rplus, consultor_rplus, coordenador_servicos (com `ON CONFLICT (role, menu_key) DO UPDATE`); demais roles sem acesso.
- `src/pages/instalacoes/Index.tsx` + rota `/instalacoes` (dentro de AppLayout):
  - Listagem de instalações (busca por cliente, Badge de status, colunas com as 3 etapas pré-venda/pré-instalação/instalação e seus status).
  - Criar instalação (dialog: seleção de cliente; uma instalação por cliente — erro claro se já existir).
  - Gerenciar etapa (dialog: técnico entre usuários ativos `tecnico_campo`, data planejada, template de checklist, status `planejado/em_andamento/concluido`).
  - Acesso à execução da etapa (link quando em andamento ou com checklist iniciado).

## Fase 3 — Tela de execução da etapa

- `src/pages/instalacoes/ExecucaoEtapa.tsx` + rota `/instalacoes/etapa/:stageId` (padrão visual de `AtendimentoPreventivo`: dados do cliente, status, botão Iniciar/Finalizar etapa).
- `src/components/instalacoes/ChecklistExecution.tsx`: motor adaptado do preventivo, **100% online** (sem Dexie/offline — este módulo nunca entra no PWA offline), reutilizando os sub-componentes compartilhados `ChecklistItemStatusButtons`, `SelectableOptionCard`, `ChecklistBlockNav`, `ChecklistItemNotes`, `NonconformityPartsManager`.
  - Query keys próprios (`['installation-checklist', stageId]` etc.).
  - Criação da execução a partir do template da etapa (snapshots de blocos/itens), marcação S/N/NA, notas, não conformidades e ações corretivas com auto-consumo das peças mapeadas ("Troca"), igual ao preventivo, mas gravando em `installation_checklists`/mirror/`installation_part_consumption`.
  - Finalizar: valida itens pendentes como no preventivo, marca checklist `concluido` e etapa `concluido`.
- Sem relatório público nesta fase (fica para depois, como nas preventivas).

## Fase 4 — Validação e encerramento

- Typecheck (`tsgo --noEmit`), build, Playwright no preview: criar instalação de teste, etapas, execução de checklist com não conformidade e peça consumida; conferir que Preventivas/Chamados não mudaram.
- Atualizar `roadmap.md`.

## Restrições respeitadas
- Nenhuma alteração em `preventive_maintenance`, `preventive_checklists`, no fluxo preventivo ou no proxy usado pelas visitas corretivas.
- `checklist_templates/blocks/items` e as tabelas genéricas de peças por ação (`checklist_action_parts`, `checklist_nonconformity_parts`) são reutilizados via FK, sem mudança de estrutura.
