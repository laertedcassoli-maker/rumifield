# Até 5 fotos por item de checklist

## O que muda para o técnico
- O item mostra uma grade de miniaturas em vez de uma foto só.
- "Adicionar foto" aparece até o item ter 5 fotos (enviadas + aguardando envio). Nada é substituído.
- Cada miniatura tem sua própria lixeira. Fotos no aparelho mostram "Aguardando envio".
- Selo do item: "Pendente" sem nenhuma foto; "Aguardando envio" se houver foto local; "Anexada" (com contagem, ex. 3/5) quando todas subiram.
- Sem sinal continua funcionando: grava no aparelho e sobe quando a conexão volta.
- Fotos já enviadas antes da mudança continuam aparecendo (viram a primeira foto do item).

## Detalhes técnicos

### 1. Migração
- `preventive_checklist_item_photos` e `installation_checklist_item_photos`: `id`, `item_id` (FK para o item, ON DELETE CASCADE), `photo_path text not null`, `created_by_user_id uuid`, `created_at`. Índice em `item_id`.
- GRANT SELECT/INSERT/UPDATE/DELETE a `authenticated`, ALL a `service_role`, SELECT a `anon` (só para espelhar a leitura pública do relatório).
- RLS espelhando exatamente as regras atuais do item pai, resolvidas via `item_id`:
  - Preventiva: leitura autenticada `true`; admin/coordenador tudo (`is_admin_or_coordinator`); insert técnico `true` (igual ao item); update/delete quando o checklist do item está `em_andamento` (mesma condição do UPDATE do item); anon lê se `is_public_preventive_visit(preventive_id_of_item(item_id))`.
  - Instalação: leitura autenticada `true`; gestão `can_manage_installations()`; técnico responsável via join item → bloco → checklist → `is_installation_stage_responsible`; anon via `is_public_installation_stage(installation_stage_of_item(item_id))`.
- Backfill: uma linha por item com `photo_path` não nulo (created_by vazio). A coluna `photo_path` fica intacta.
- Limite de 5 validado no app (não por constraint).

### 2. Armazenamento local (`offline-checklist-db.ts`)
- Nova versão 9: `checklistItemPhotos: "++localId, itemId, table, _pendingSync"`. Como o Dexie não troca a chave primária de uma tabela existente, a versão 9 cria a nova tabela `checklistItemPhotosV2` e o `upgrade()` copia os registros da antiga (`id` → `itemId`), preservando pendências; a tabela antiga é removida numa versão 10 (`checklistItemPhotos: null`). O código passa a usar a nova tabela.

### 3. Sincronização (`checklist-item-photo-sync.ts`)
- `syncItemPhoto(itemId)` busca todas as fotos locais do item (`where('itemId')`), envia cada uma em `${userId}/checklist-items/${itemId}/${localId}-${createdAt}.${ext}` (primeiro segmento = userId, regra do bucket intocada).
- Após envio: insere linha na tabela filha com `.select('id')` (detecta bloqueio silencioso), timeout 15s, e só então apaga o registro local por `localId`. Em erro, fica para a próxima tentativa.
- `syncPendingItemPhotos` e o disparo ao reconectar seguem iguais.

### 4. Componente (`ChecklistItemPhoto.tsx`)
- Busca linhas da tabela filha do item + URLs assinadas; `useLiveQuery` das locais do item.
- Grade de miniaturas; botão "Adicionar foto" enquanto total < 5.
- Remover: enviada → apaga linha (com `.select('id')`) e o arquivo do storage; local → apaga o registro por `localId`.

### 5. Validação (`assertRequiredPhotos`)
- Após sincronizar, lista itens do checklist cujo template exige foto e que não têm nenhuma linha na tabela filha.
- Os que têm foto local → "Foto ainda não enviada…"; os demais → "Foto obrigatória faltando…" (mensagens atuais).
- Chamadas em `preventivas/ChecklistExecution.tsx` e `instalacoes/ChecklistExecution.tsx` não mudam.

### Fora do escopo
Coluna `photo_path`, "Fotos da Visita", regras do bucket, relatórios públicos. Nada é publicado.

## Validação
- Checagem de tipos.
- Conferir por consulta que o backfill trouxe todas as fotos existentes.
- Playwright: item com foto antiga aparece; adicionar até 5 e o botão some; remover uma; offline adicionar 2, reconectar e confirmar 2 linhas novas e fila local vazia; concluir sem foto continua bloqueado.
