

## 1. Nova opcao "Novo Pedido" na origem de estoque de pecas

### 2. Campo "Codigo Univoco do Ativo" ao selecionar estoque do tecnico

---

### Resumo das mudancas

Duas melhorias no bloco de pecas consumidas durante visitas preventivas:

**Recurso A** -- Adicionar terceira opcao de origem "Novo Pedido" no toggle de stock_source. Pecas marcadas com essa origem geram automaticamente uma solicitacao de pecas (tabela `pedidos` + `pedido_itens`) no momento do encerramento da visita.

**Recurso B** -- Ao selecionar "Tecnico" como origem, exibir campo para digitar/buscar o codigo univoco do ativo (`workshop_items.unique_code`). Se o codigo nao existir no cadastro, sera criado automaticamente ao sincronizar.

---

### Alteracoes no banco de dados

1. **Adicionar coluna `asset_unique_code`** na tabela `preventive_part_consumption`:
   - Tipo: `text`, nullable
   - Armazena o codigo univoco do ativo quando a origem e "tecnico"

2. **Nenhuma alteracao na coluna `stock_source`**: atualmente e `text` sem enum/check constraint, entao aceita o novo valor `'novo_pedido'` sem migracao adicional.

3. **Adicionar coluna `preventive_id`** na tabela `pedidos` (opcional, para rastreabilidade):
   - Tipo: `uuid`, nullable, FK para `preventive_maintenance(id)`
   - Permite identificar que o pedido foi gerado a partir de uma visita preventiva

---

### Alteracoes em `src/components/preventivas/ConsumedPartsBlock.tsx`

**PartItem (toggle de origem):**
- Converter o `ToggleGroup` de 2 para 3 opcoes: `tecnico`, `fazenda`, `novo_pedido`
- Opcao "Novo Pedido" com icone `ShoppingCart` e cor distinta (ex: roxo/violet)
- Ao selecionar `tecnico`, exibir campo `Input` para "Cod. Univoco do Ativo"
  - Busca em tempo real na tabela `workshop_items` pelo `unique_code`
  - Se encontrado, exibe confirmacao (nome da peca vinculada)
  - Se nao encontrado, salva o codigo digitado para criacao posterior
- Ao selecionar `novo_pedido`, esconder o campo de codigo univoco

**Dialog "Adicionar Peca Manual":**
- Adicionar mesma terceira opcao no ToggleGroup do dialog
- Campo de codigo univoco condicional ao selecionar "Tecnico"

**Mutations:**
- `updateStockSourceMutation`: ja atualiza stock_source com qualquer valor texto
- Nova mutation para salvar `asset_unique_code` na `preventive_part_consumption`

---

### Alteracoes em `src/pages/preventivas/AtendimentoPreventivo.tsx`

**Na funcao `completeMutation` (encerramento da visita):**
- Apos marcar a visita como concluida, verificar se existem pecas com `stock_source = 'novo_pedido'`
- Se existirem, criar automaticamente:
  1. Um registro em `pedidos` (status `solicitado`, vinculado ao `cliente_id` da visita, `preventive_id` para rastreio)
  2. Registros em `pedido_itens` para cada peca com `stock_source = 'novo_pedido'`, agrupando quantidades por `part_id`

**Na funcao `validateBeforeComplete`:**
- Manter validacao existente de `stock_source IS NULL` (pecas sem origem)
- Nao bloquear pecas com `novo_pedido` (e uma opcao valida)

---

### Alteracoes em `src/pages/preventivas/AtendimentoPreventivo.tsx` e `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

**Criacao de ativo ao sincronizar (campo codigo univoco):**
- No encerramento, para pecas com `stock_source = 'tecnico'` e `asset_unique_code` preenchido:
  - Buscar em `workshop_items` se `unique_code` ja existe
  - Se nao existir, criar novo registro em `workshop_items` com:
    - `unique_code`: o codigo digitado
    - `omie_product_id`: o `part_id` da peca consumida
    - `status`: 'disponivel'

---

### Fluxo do usuario

```text
Tecnico executa checklist preventivo
  |
  v
Seleciona falha / adiciona peca manualmente
  |
  v
Escolhe origem da peca:
  [Tecnico]  --> campo "Cod. Univoco" aparece (busca/cria ativo)
  [Fazenda]  --> sem campo adicional
  [Novo Pedido] --> sem campo adicional, peca sera solicitada
  |
  v
Encerra visita
  |
  v
Se houver pecas "Novo Pedido":
  --> Cria pedido automatico para o cliente
  --> Vincula ao preventive_id
  |
Se houver pecas "Tecnico" com cod. univoco novo:
  --> Cria ativo no cadastro (workshop_items)
```

---

### Arquivos afetados

| Arquivo | Tipo de alteracao |
|---|---|
| Migracao SQL | Adicionar `asset_unique_code` em `preventive_part_consumption`, `preventive_id` em `pedidos` |
| `src/components/preventivas/ConsumedPartsBlock.tsx` | Terceira opcao no toggle, campo cod. univoco, mutations |
| `src/pages/preventivas/AtendimentoPreventivo.tsx` | Criacao automatica de pedido e ativo no encerramento |
| `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` | Mesmas mudancas de encerramento (se visitas corretivas usam o mesmo bloco) |

