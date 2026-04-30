## Objetivo

Permitir que apenas o usuário **Phelipe Rogerio** (`phelipe.rogerio@rumina.com.br`) possa editar um checklist de preventiva mesmo após ele ter sido concluído. Para os demais usuários, o comportamento atual é mantido (checklist concluído = somente leitura).

## Como funciona hoje

No `ChecklistExecution.tsx`, quando `existingChecklist.status === 'concluido'`, a flag `isCompleted` bloqueia tudo:
- Botões de status dos itens ficam `disabled={isCompleted}`
- Botões "Concluir" e "Trocar checklist" são escondidos
- Auto-save é abortado (`if (existingChecklist.status === 'concluido') return;`)
- Itens, ações e não-conformidades viram visualização (read-only)

## Mudanças propostas

### 1. Identificar o usuário privilegiado
Em vez de fixar UUID no código (frágil), vou criar uma função SQL `can_edit_completed_checklist(_user_id uuid)` que retorna `true` se:
- O usuário tem role `admin`, **OU**
- O email do usuário é `phelipe.rogerio@rumina.com.br`

Isso fica fácil de manter — se amanhã quiser liberar para outro usuário, basta editar a função.

### 2. Hook no front
Criar um hook `useCanEditCompletedChecklist()` que consulta essa função via RPC e retorna `boolean`.

### 3. Ajustar `ChecklistExecution.tsx`
- Substituir `const isCompleted = ...` por uma flag derivada: `isReadOnly = isCompleted && !canEditCompleted`
- Trocar todos os usos de `isCompleted` que controlam **edição** por `isReadOnly`
- Manter `isCompleted` apenas para o **badge visual "Concluído"** (todos continuam vendo o badge verde)
- No bloco de ações (Concluir / Trocar checklist):
  - Se `isCompleted && canEditCompleted`, mostrar um aviso amarelo "Modo edição (checklist concluído) — alterações serão salvas" e manter os controles habilitados
  - Esconder o botão "Concluir" (já está concluído), mas manter "Trocar checklist" e edição inline dos itens

### 4. Liberar auto-save no modo admin
No `useEffect` de hidratação/save (linha 448) e nas mutations (`updateItemMutation`, `toggleActionMutation`, `toggleNonconformityMutation`), remover o early-return baseado em `status === 'concluido'` quando `canEditCompleted` for `true`.

### 5. RLS
As policies das tabelas `preventive_checklists`, `preventive_checklist_items` e `preventive_checklist_item_actions` já permitem update por usuários autenticados — não precisam mudar. A regra é puramente client-side + RPC.

## Arquivos afetados

- **Migration SQL** (nova função `can_edit_completed_checklist`)
- `src/hooks/useCanEditCompletedChecklist.ts` (novo)
- `src/components/preventivas/ChecklistExecution.tsx` (ajustes de gating)

## Comportamento final

| Usuário | Ao abrir checklist concluído |
|---|---|
| Phelipe Rogerio / Admin | Vê badge "Concluído" + aviso de modo edição. Pode alterar status, ações, NCs, peças. Auto-save ativo. |
| Demais (técnicos/consultores) | Vê badge "Concluído". Tudo somente leitura, como hoje. |

Posso seguir?
