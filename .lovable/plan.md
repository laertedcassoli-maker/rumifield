## Objetivo

Quando o usuário adicionar a peça **PRD00605** (Solenóide) em **Novo Pedido / Pedido em rascunho**, exibir uma nova seção **"Modelo"** logo acima de **Urgência**, com duas opções: **Modelo 2x** e **Modelo 3x**. O valor deve ser obrigatório quando a peça estiver no pedido e ser persistido no banco.

Nenhuma outra regra existente (ex.: vínculo automático PRD00605 → PRD00639) será alterada.

## Mudanças

### 1. Banco (migração)

Adicionar coluna na tabela `pedidos`:

- `solenoide_modelo` text NULL — aceita apenas `'2x'` ou `'3x'` (validado via CHECK).

```text
pedidos
 └── solenoide_modelo  text  null   -- '2x' | '3x'
```

### 2. UI — `src/pages/Pedidos.tsx`

- Adicionar `solenoide_modelo: ''` ao estado `form` (e nos resets existentes).
- Calcular `hasSolenoide` a partir de `itens` + catálogo de peças (procurando `codigo === 'PRD00605'`).
- Renderizar nova seção **"Modelo"** (ToggleGroup `2x` / `3x`) imediatamente **acima** do bloco Urgência, apenas quando `hasSolenoide` for verdadeiro.
- Em `handleShowConfirmation`: se `hasSolenoide && !form.solenoide_modelo` → toast destrutivo "Selecione o Modelo (2x ou 3x) da solenóide".
- Em `handleSubmit`:
  - INSERT: incluir `solenoide_modelo: hasSolenoide ? form.solenoide_modelo : null`.
  - UPDATE (rascunho): atualizar o mesmo campo.
- Em `handleEditPedido`: hidratar `form.solenoide_modelo` a partir de `pedido.solenoide_modelo || ''`.
- Se o usuário remover a peça PRD00605 do pedido, limpar `form.solenoide_modelo`.

### 3. Fora do escopo

- `EditarPedidoSolicitado` (edição após transmitido), Kanban, exibição em listagens — não serão alterados nesta etapa para respeitar "não alterar nenhuma outra regra existente". Posso incluir depois se desejar.
