

## Replicar fluxo de criacao automatica de pedidos na visita corretiva

### Problema

Quando uma visita corretiva e encerrada, as pecas registradas no bloco "Pecas" (salvas em `preventive_part_consumption`) nao geram Solicitacoes de Pecas (pedidos) automaticamente. Na visita preventiva, ao encerrar, o sistema:

1. Cria um pedido do tipo `envio_fisico` para pecas com `stock_source = 'novo_pedido'`
2. Cria um pedido do tipo `apenas_nf` para pecas com `stock_source = 'tecnico'`
3. Registra ativos novos na `workshop_items` para pecas com `is_asset = true`

A visita corretiva nao faz nada disso -- apenas atualiza o status da `ticket_visits` e adiciona timeline.

### Solucao

Adicionar a mesma logica de criacao automatica de pedidos ao `completeMutation` em `ExecucaoVisitaCorretiva.tsx`, adaptada para o contexto corretivo.

---

### Mudancas

#### 1. `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` -- completeMutation (linhas 232-351)

Apos a atualizacao de status da visita e antes da insercao na timeline, adicionar a logica de auto-criacao de pedidos:

**a) Pedido para pecas com `stock_source = 'novo_pedido'`:**
- Buscar pecas consumidas com `stock_source = 'novo_pedido'` em `preventive_part_consumption`
- Criar um `pedido` com `origem = 'chamado'`, `tipo_envio = 'envio_fisico'`, vinculado ao `client_id` da visita
- Inserir `pedido_itens` agrupados por `part_id`
- Vincular o pedido ao chamado via `ticket_parts_requests`

**b) Pedido para pecas com `stock_source = 'tecnico'`:**
- Buscar pecas consumidas com `stock_source = 'tecnico'`
- Criar um `pedido` com `origem = 'chamado'`, `tipo_envio = 'apenas_nf'`
- Inserir `pedido_itens` agrupados
- Vincular via `ticket_parts_requests`

**c) Registro de ativos (workshop_items):**
- Para pecas com `stock_source = 'tecnico'` que tenham `asset_unique_code` preenchido e `is_asset = true` na tabela `pecas`
- Verificar se o `unique_code` ja existe em `workshop_items`
- Se nao existir, criar o registro

### Detalhes tecnicos

A logica sera essencialmente uma copia da que ja existe em `AtendimentoPreventivo.tsx` (linhas 177-285), adaptando:

- `origem` de `'preventiva'` para `'chamado'`
- A mensagem de `observacoes` para referenciar o chamado (ex: `visit.visit_code`)
- O campo `preventive_id` no pedido apontar para `visit.preventiveId`
- Adicionalmente, registrar na tabela `ticket_parts_requests` com `ticket_id` e `visit_id`

**Arquivos modificados:**
- `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` -- unico arquivo alterado
