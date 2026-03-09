

## Substituir `navigator.onLine` por estado confiável em todo o projeto

### Problema
Encontrei **5 arquivos** usando `navigator.onLine` diretamente. No iPhone (e potencialmente Android), esse valor é unreliável — pode retornar `true` mesmo sem conexão real, causando travamentos.

### Arquivos afetados

| Arquivo | Usos | Risco |
|---------|------|-------|
| `src/components/preventivas/ChecklistExecution.tsx` | 6 usos em mutations (item, action, nonconformity) | **Alto** — mesmo cenário do check-in |
| `src/hooks/useOfflineChecklist.ts` | 5 usos (init, sync, debounce, updateItem, toggles) | **Alto** — controla toda a sync do checklist |
| `src/hooks/useOfflineSync.ts` | 2 usos (init, syncAll) | **Médio** — sync geral |
| `src/hooks/useOfflineQuery.ts` | 1 uso (init) | **Médio** — fallback de queries |
| `src/pages/Instalar.tsx` | 1 uso (UI cosmético) | **Baixo** — apenas visual |

### Solução

Todos esses hooks/componentes já usam event listeners (`online`/`offline`) para manter um estado `isOnline` local. O problema é que o **valor inicial** vem de `navigator.onLine` e algumas funções internas consultam `navigator.onLine` diretamente em vez do estado.

**Mudanças:**

1. **`ChecklistExecution.tsx`** — Substituir os 6 `navigator.onLine` pelo `isOnline` do hook `useOfflineChecklist` (que já é importado). Nas mutations, qualquer erro online faz fallback silencioso (já salva local primeiro).

2. **`useOfflineChecklist.ts`** — Substituir os 4 usos internos de `navigator.onLine` pelo estado `isOnline` do próprio hook. Manter `navigator.onLine` apenas na inicialização do `useState`.

3. **`useOfflineSync.ts`** — Substituir `navigator.onLine` em `syncAll` pelo estado `isOnline`. Manter na inicialização.

4. **`useOfflineQuery.ts`** — Já usa estado local corretamente. Manter como está.

5. **`Instalar.tsx`** — Apenas cosmético. Manter como está.

### Impacto
Garante que o checklist e a sincronização funcionem corretamente offline em dispositivos móveis, usando o mesmo padrão já aplicado no check-in.

