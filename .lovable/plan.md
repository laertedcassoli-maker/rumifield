

## Diagnóstico

No modal `ConcluirPedidoDialog.tsx` há apenas 1 campo `nf_numero` (obrigatório). Usuário quer adicionar **1 campo extra** para uma segunda NF, opcional.

Confirmado: tabela `pedidos` tem só `omie_nf_numero`. Precisa nova coluna.

## Plano

### 1. Migration (DB)
- Adicionar `omie_nf_numero_2 text` (nullable) em `pedidos`.

### 2. `src/components/pedidos/ConcluirPedidoDialog.tsx`
- Novo state `nfNumero2`.
- Novo `<Input>` "Número da NF (Adicional)" abaixo do campo atual, com label indicando "(opcional)".
- Passar `nfNumero2` para `onConfirm` (assinatura ganha 5º parâmetro opcional).
- Reset no submit.

### 3. `src/pages/Pedidos.tsx` (handler de conclusão)
- Receber `nfNumero2` e gravar em `omie_nf_numero_2` no update de `pedidos`.

### 4. Exibição (Card + Lista + Relatórios)
- Localizar onde `omie_nf_numero` é exibido (card detalhe / lista Kanban / export) e adicionar `omie_nf_numero_2` ao lado, formato `NF: 123 / 456` quando houver a segunda.

### Fora do escopo
- Não mexer em `ProcessarPedidoDialog` (não pede NF).
- Não tornar o segundo campo obrigatório.

