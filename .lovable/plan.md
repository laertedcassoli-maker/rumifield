# Dead-letter para sincronização offline

Corrige a perda silenciosa: itens que atingem `retryCount >= 5` deixam de ser apagados e passam a ser movidos para uma dead-letter local (Dexie) e remota (Supabase), com relato de erro estruturado.

## 1. Schema Supabase — migration nova

Criar tabela `public.sync_dead_letter`:

- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `table_name text not null`
- `operation text not null`
- `payload jsonb not null`
- `retry_count integer not null default 0`
- `error_message text`
- `created_at timestamptz not null default now()`

GRANTs: `SELECT, INSERT` para `authenticated`; `ALL` para `service_role`. RLS ligado.

Policies:
- INSERT: `auth.uid() = user_id`
- SELECT: `auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordenador_rplus') OR has_role(auth.uid(), 'coordenador_servicos') OR has_role(auth.uid(), 'coordenador_logistica')`

Índice em `(user_id, created_at desc)` e `(table_name)`.

## 2. Dexie — nova store `syncDeadLetter` (sem apagar dados)

`src/lib/offline-db.ts`: bump para `this.version(8)` adicionando apenas `syncDeadLetter: "++id, table, operation, createdAt"`. Interface `DeadLetterItem { id?, table, operation, data, retryCount, errorMessage, createdAt }`. Helpers `moveToDeadLetter(item, errorMessage)` e `countDeadLetter()`.

`src/lib/offline-checklist-db.ts`: bump para `this.version(5)` acrescentando `checklistDeadLetter: "++id, table, operation, createdAt"`, com helpers equivalentes.

Os `version(n)` anteriores permanecem intocados para preservar dados de usuários já instalados.

## 3. Hooks — mover em vez de apagar

`src/hooks/useOfflineSync.ts` (~linha 379): substituir o bloco que hoje chama `removeSyncItem` após `retryCount >= 5` por:
1. `offlineDb.moveToDeadLetter(item, String(error?.message ?? error))` — insere na store local e remove da fila.
2. Best-effort `supabase.from('sync_dead_letter').insert({...})` com o `user_id` do `auth.getUser()`; falhas não impedem o fluxo (o registro local persiste até re-tentativa futura de upload).
3. Report para Sentry: como o projeto ainda não integrou `@sentry/*`, criar util `src/lib/reportDeadLetter.ts` que chama `window.Sentry?.captureException?.(err, { extra: { table, operation, retryCount } })` de forma defensiva e sempre faz `console.error`. Assim, quando Sentry for plugado no futuro, os relatos fluem automaticamente.
4. Toast informativo mantido.

`src/hooks/useOfflineChecklist.ts` (~linha 222): mesma troca usando `offlineChecklistDb.moveToDeadLetter` e o mesmo util.

Nenhuma outra lógica de retry/sync é tocada — itens com `retryCount < 5` continuam iguais.

## 4. Contador de dead-letter exposto

Em `useOfflineSync`: adicionar estado `deadLetterCount`, `refreshDeadLetterCount()` que soma `offlineDb.countDeadLetter() + offlineChecklistDb.countDeadLetter()`, atualizado junto do `updatePendingCount` e após cada move. Retornar `deadLetterCount` no objeto do hook para uso futuro em um dashboard.

## Detalhes técnicos

- `moveToDeadLetter` roda numa transação Dexie (`syncQueue` + `syncDeadLetter`) para garantir atomicidade local.
- O insert no Supabase envia `payload: item.data` como jsonb; erros de RLS/rede são engolidos após `console.warn` — o item permanece na store local e poderá ser re-enviado num flush futuro (fora do escopo desta task).
- Nenhum outro arquivo/hook é alterado.
