## Objetivo

Sempre que **PRD00605** for adicionada a uma solicitação de peças, incluir automaticamente **PRD00639** com quantidade **3** — sem duplicar e mantendo persistência no banco.

## Onde aplicar (frontend)

A automação roda em **dois pontos** que adicionam itens:

1. **`src/pages/Pedidos.tsx`** — diálogo "Criar Novo" (função `updateItem` quando seta `peca_id` em ~linha 1000) e também no `addItem`.
2. **`src/components/pedidos/EditarPedidoSolicitado.tsx`** — editor de pedido transmitido (função `updateNewItem` em ~linha 372).

### Lógica em ambos

Após selecionar uma peça num item:
- Se a peça selecionada for **PRD00605**:
  - Verificar se já existe linha com **PRD00639** (em `itens` + `newItems` + items existentes não cancelados).
  - Se **não** existir → adicionar uma nova linha com `peca_id = PRD00639` e `quantidade = 3`.
  - Se **existir** → não fazer nada (sem duplicar, sem alterar quantidade já lançada).

Ao **remover** o item da PRD00605:
- Se houver linha de PRD00639 **com quantidade exatamente 3** e que tenha sido adicionada nesta sessão (não veio do banco), remover também. Caso contrário, manter (usuário pode ter alterado manualmente).

Para identificar as peças por código (e não por ID hard-coded), buscar via `pecas?.find(p => p.codigo === 'PRD00605')` — já temos `pecas` carregadas no componente.

## Backend (garantia de consistência)

Criar **trigger SQL** em `pedido_itens` (AFTER INSERT) que:
- Se `peca_id` corresponde à peça com `codigo = 'PRD00605'`, e o mesmo `pedido_id` ainda **não** tem item da peça `PRD00639`, insere automaticamente um item com `peca_id` da PRD00639 e `quantidade = 3`.
- Idempotente: a verificação de existência impede duplicação em qualquer cenário (UI, importação futura, edge function, SQL direto).

Dessa forma, mesmo que algum fluxo futuro insira PRD00605 sem passar pela UI, a regra continua valendo.

## Critério de sucesso

- Adicionar PRD00605 manualmente → linha PRD00639 (qty 3) aparece automaticamente na UI.
- Salvar a solicitação → ao reabrir, ambas as peças estão lá com quantidades corretas.
- Adicionar PRD00605 quando PRD00639 já existe → nada é duplicado.
- Remover PRD00605 (recém adicionada na sessão) → PRD00639 (qty 3) também sai da UI.
- Inserir PRD00605 via SQL/edge function → trigger garante que PRD00639 também é gravada.

## Observação

Os códigos PRD00605 e PRD00639 ficarão como referência por **código** (não ID). Caso amanhã queira generalizar (ex.: cadastro de "peças vinculadas" no admin), abrimos uma tabela de regras — por ora, a regra fica explícita no front + trigger.
