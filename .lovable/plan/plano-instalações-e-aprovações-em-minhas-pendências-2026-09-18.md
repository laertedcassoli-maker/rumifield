# Plano — Instalações e Aprovações em "Minhas Pendências"

## Objetivo

Adicionar dois novos blocos somente leitura à tela "Minhas Pendências": etapas de Instalação atribuídas ao usuário (técnico ou CSM) e aprovações de Pré Instalação pendentes (só para Coordenador de Serviços/admin). O badge do menu reflete a soma automaticamente.

## Mudanças

### 1. `src/hooks/useMinhasPendencias.ts`

- Novo tipo exportado `PendenciaInstalacao`:
  `{ id, installationId, stage, clienteNome, fazenda, plannedDate, status }`.
- Nova query `instalacoes` (queryKey `['installations', 'pendencias', uid]`):
  - `installation_stages` com `.or('technician_user_id.eq.<uid>,csm_user_id.eq.<uid>')` e `.in('status', ['planejado', 'em_andamento'])` — **não** inclui `aguardando_aprovacao`.
  - Ordena por `planned_date` ascendente; traz cliente/fazenda via join aninhado `installations(cliente_id, clientes(nome, fazenda))` (mesmo padrão do join já usado nas queries de pedidos) ou via `fetchClientesMap` como fallback.
- Nova query `aprovacoesInstalacao` (queryKey `['installations', 'pendencias-aprovacao', uid]`):
  - `enabled` somente quando `role === 'coordenador_servicos' || role === 'admin'` (obtido via `useAuth`).
  - `installation_stages` com `.eq('stage', 'pre_instalacao').eq('status', 'aguardando_aprovacao')`, mesma projeção de cliente/fazenda.
- As duas queries entram no `total` somado, no `isLoading` combinado e no retorno do hook (mesmo padrão dos 4 domínios existentes — nenhum dos blocos existentes é alterado).
- `useMinhasPendenciasCount()` continua somando tudo automaticamente — nenhuma mudança adicional no badge.

### 2. `src/pages/MinhasPendencias.tsx`

- Novo label em `statusLabels`: `aguardando_aprovacao: 'Aguardando aprovação'`.
- Seção **"Instalações"** (ícone `HardHat`):
  - Linhas `PendenciaRow` com `code = STAGE_LABELS[item.stage]` (`Pre Instalação` / `Instalação` — mapa local `{ pre_instalacao: 'Pré Instalação', instalacao: 'Instalação' }`), cliente/fazenda, `formatDate(plannedDate)`, status, link `/instalacoes/etapa/${item.id}`.
  - Estado vazio: "Nenhuma pendência em Instalações".
- Seção **"Aprovações de Instalação"** (ícone `ClipboardCheck` ou `CheckCircle2`):
  - Renderizada **somente** quando `role === 'coordenador_servicos' || role === 'admin'` (retorno antecipado `{canApprove && (<Section .../>)}` — nunca mostra a seção vazia para outros papéis).
  - Mesma estrutura de linha; estado vazio (quando exibida): "Nenhuma aprovação pendente".
- `useAuth()` passa a ser usado na página para obter `role`.

## Regras e limites

- Tela 100% leitura/navegação; nenhuma mutação nova; RLS de leitura de `installation_stages` já é ampla (`USING(true)`).
- QueryKeys com prefixo `['installations', ...]` — já invalidadas pelas mutações existentes; nenhuma invalidação nova.
- Não altera os 4 blocos existentes, nem o fluxo de Instalações (criação, execução, aprovação).

## Verificação

- Typecheck + build.
- Playwright: cenário com etapa `planejado` atribuída ao usuário (aparece em "Instalações") e etapa `aguardando_aprovacao` (não aparece para técnico/CSM; aparece em "Aprovações de Instalação" para admin/coordenador); badge do menu reflete a soma; link "Abrir" navega para `/instalacoes/etapa/:id`.

## Detalhes técnicos

- `installation_stages`: colunas `id, installation_id, stage, status, technician_user_id, csm_user_id, planned_date`; FK `installation_id → installations → clientes`.
- Padrão de linha/seção: componentes `Section` e `PendenciaRow` já existentes em `MinhasPendencias.tsx`.
- `role` exposto por `useAuth()` de `@/contexts/AuthContext`.
