

## Diagnóstico

Em `src/components/pedidos/AssetSearchField.tsx`, a função `searchAssets` busca em `workshop_items` apenas por `unique_code` ilike, sem filtro de status. Resultado: ativos `em_manutencao` aparecem na lista (apenas exibem um toast ao selecionar). O usuário pede para **filtrar** mostrando só os disponíveis.

Status existentes hoje: `disponivel` (84) e `em_manutencao` (59).

## Plano

### `src/components/pedidos/AssetSearchField.tsx`

1. Em `searchAssets`, adicionar `.eq('status', 'disponivel')` ao SELECT.
2. No `handleSelect`, remover a checagem `if (asset.status === 'em_manutencao')` (não vai mais aparecer; código morto).
3. Manter o fluxo de **criar novo ativo** quando a busca não retornar nada — o ativo é criado com `status: 'disponivel'` (já é o default no upsert), então continua coerente.
4. Manter exibição do badge de status no item da lista (todos serão "disponivel", mas mantém consistência visual e cobre se outros status forem adicionados no futuro com a mesma regra).

### Fora do escopo
- Não alterar `MultiAssetField` nem `TicketPartsRequestPanel`.
- Não mexer em telas de oficina onde faz sentido listar ativos `em_manutencao`.
- Não adicionar toggle "ver todos os status" — usuário pediu o filtro direto.

