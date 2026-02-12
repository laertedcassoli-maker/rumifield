

## Correção: Busca de ativos não carrega ao abrir o campo

### Problema
O componente `AssetSearchField` só dispara a busca quando o usuário digita algo no campo de texto (`onValueChange`). Ao abrir o popover, a lista `assets` está vazia e a mensagem "Nenhum ativo encontrado para este tipo de peça" aparece imediatamente -- mesmo existindo ativos cadastrados.

### Causa raiz
Linha 58-59 do componente: a função `searchAssets` nunca é chamada automaticamente ao abrir. Ela depende de `onValueChange` do `CommandInput`.

### Solução
Disparar a busca automaticamente quando o popover abre (`open` muda para `true`), passando string vazia como query para listar todos os ativos daquele tipo de peça.

### Alteração

**`src/components/pedidos/AssetSearchField.tsx`**
- Adicionar `useEffect` que observa `open`: quando `open === true`, chamar `searchAssets('')` para carregar a lista inicial
- Remover a condição `if (!query && !pecaId) return` e trocar por `if (!pecaId) return` -- permitindo busca com query vazia (lista todos)

### Resultado esperado
Ao abrir o campo de ativo na SP-00000039, os 2 ativos cadastrados (1234 e 987834) aparecerão imediatamente na lista, sem precisar digitar nada.

