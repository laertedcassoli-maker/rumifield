

## Validar peças vinculadas antes de encerrar visita

### Contexto
A função `validateBeforeComplete` em `AtendimentoPreventivo.tsx` (linha 402) já valida origem de peças e mídia antes de encerrar. A tabela `preventive_part_consumption` já possui `exec_item_id` que vincula peças a itens do checklist. Precisamos adicionar uma validação que cruze itens do checklist com ação "Troca" contra peças existentes.

### Alterações

**Arquivo: `src/pages/preventivas/AtendimentoPreventivo.tsx`**

Na função `validateBeforeComplete` (após a validação de `stock_source`, ~linha 419), adicionar:

1. Buscar o checklist ativo da visita (`preventive_checklists` onde `preventive_id = routeItem.preventiveId` e `status = 'em_andamento' OR 'concluido'`)
2. Buscar todos os `preventive_checklist_items` com `status = 'N'` (falha) desse checklist
3. Para cada item com falha, buscar suas `preventive_checklist_item_actions` e filtrar as que contenham "troca" (case-insensitive) no `action_label_snapshot`
4. Para cada item que tem ação de troca, verificar se existe pelo menos 1 registro em `preventive_part_consumption` com `exec_item_id = item.id` para essa visita
5. Se algum item não tiver peça, adicionar um `blockingError`:
   - `"Existem itens no checklist com troca de peça que ainda não possuem peça vinculada. Adicione uma peça para cada item antes de finalizar a visita."`

### Lógica resumida

```text
checklist items (status='N')
  └─ actions (label contains 'troca')
       └─ para cada item: EXISTS preventive_part_consumption WHERE exec_item_id = item.id?
            └─ NÃO → blockingError
```

### Escopo
- Apenas 1 arquivo alterado: `AtendimentoPreventivo.tsx`
- Nenhuma alteração de banco, layout ou lógica de checklist
- Aproveitamento total das colunas existentes (`exec_item_id` em `preventive_part_consumption`)

