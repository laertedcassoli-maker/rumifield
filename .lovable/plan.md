

## Criar ativo direto pelo campo de busca

### O que muda
Quando o usuario digita um codigo no campo de busca e nao encontra nenhum ativo, aparecera um botao "+ Criar ativo [codigo digitado]" na lista. Ao clicar, o sistema cria o registro na tabela `workshop_items` automaticamente e ja vincula ao item do pedido.

### Alteracoes

**`src/components/pedidos/AssetSearchField.tsx`**

1. Na area do `CommandEmpty`, substituir a mensagem estatica por um botao de criacao quando `searchValue` nao esta vazio e a lista esta vazia
2. O botao exibe: `+ Criar ativo "CODIGO_DIGITADO"`
3. Ao clicar, executa INSERT na tabela `workshop_items` com:
   - `unique_code`: o texto digitado pelo usuario
   - `omie_product_id`: o `pecaId` recebido via props
   - `status`: "disponivel" (default)
   - demais campos ficam null (motor code, meter hours, etc.)
4. Apos criar, seleciona automaticamente o novo ativo (chama `handleSelect` com o registro recem-criado)
5. Adicionar estado `isCreating` para feedback visual (loading no botao)

### Detalhes tecnicos

- Campos obrigatorios para INSERT em `workshop_items`: `unique_code` (text, NOT NULL) e `omie_product_id` (uuid, NOT NULL) -- ambos disponiveis no componente
- RLS: apenas admin/coordenador pode inserir (`is_admin_or_coordinator`). Se o usuario nao tiver permissao, o INSERT vai falhar e exibiremos um toast de erro
- O botao so aparece quando ha texto digitado e nenhum resultado encontrado (evita criacao acidental)

### Fluxo do usuario

1. Abre o campo de ativo
2. Digita um codigo (ex: "1234")
3. Se nao encontrar, ve o botao "+ Criar ativo 1234"
4. Clica no botao
5. Ativo e criado e ja fica vinculado ao item do pedido

