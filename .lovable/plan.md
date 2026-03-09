

## Problema

Quando o código do motor é editado via MotorSection (botão de lápis), a mutation invalida apenas a query `['workshop-item-motor']`. Porém, o código do motor usado para pré-preencher "Motor Retirado" no diálogo de adicionar peça vem de outra query: `['work-order-items']`, que busca `workshop_items.current_motor_code` via join. Como essa query não é invalidada, o valor fica `null` (stale).

## Correção

**Arquivo:** `src/components/oficina/MotorSection.tsx` (linha 118)

Adicionar invalidação da query `work-order-items` no `onSuccess` do `updateMotorCodeMutation`:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['workshop-item-motor', workshopItemId] });
  queryClient.invalidateQueries({ queryKey: ['work-order-items'] });
  setEditDialogOpen(false);
  setNewMotorCode('');
  toast.success('Código do motor atualizado!');
},
```

Isso garante que ao editar o código do motor e depois adicionar uma peça de motor, o campo "Motor Retirado" já venha preenchido com o código correto.

**Escopo:** 1 linha adicionada em 1 arquivo.

