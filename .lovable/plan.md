

## Melhorar Busca de Codigo Univoco com Filtro por Peca

### Problema Atual

O campo "Cod. Univoco do Ativo" busca em **todos** os ativos da tabela `workshop_items`, sem considerar qual peca foi selecionada. Se o tecnico esta trocando uma Pistola, ele ve codigos de DDs e vice-versa.

### Solucao

Refatorar o `AssetCodeInput` para:

1. **Receber o `partId`** da peca consumida como prop
2. **Filtrar a busca** por `omie_product_id = partId` na tabela `workshop_items`
3. **Busca parcial** com `ILIKE '%codigo%'` a partir de 3 caracteres
4. **Exibir lista de sugestoes** em um dropdown quando ha multiplos resultados
5. Ao selecionar uma sugestao, preencher o campo automaticamente

### Fluxo do Usuario

```text
Tecnico seleciona peca "Pistola DeLaval" (is_asset = true)
Tecnico seleciona origem "Tecnico"
    |
Campo de codigo aparece
Digita "12"  -> nada acontece (< 3 chars)
Digita "123" -> busca: workshop_items WHERE omie_product_id = [pistola_id] AND unique_code ILIKE '%123%'
    |
Encontra 3 ativos:
  - PIST-00123
  - PIST-01234
  - PIST-12300
    |
Mostra dropdown com opcoes
Tecnico seleciona "PIST-00123"
    |
Campo preenchido + info do ativo exibida
```

Se nenhum resultado: mostra "Codigo novo -- sera criado ao encerrar"

### Detalhes Tecnicos

**Alteracoes em `src/components/preventivas/ConsumedPartsBlock.tsx`:**

1. **`AssetCodeInput`** -- adicionar prop `partId: string`
   - Mudar query de `.eq('unique_code', code)` para `.ilike('unique_code', '%code%').eq('omie_product_id', partId).limit(10)`
   - Retornar array em vez de single
   - Threshold de busca: 3 caracteres

2. **UI do `AssetCodeInput`**:
   - Abaixo do input, mostrar lista de resultados como botoes clicaveis (estilo Command/lista simples)
   - Cada item mostra o `unique_code` e status do ativo
   - Ao clicar, preenche o input
   - Se nenhum resultado e 3+ chars: "Codigo novo"
   - Se 1 resultado exato: "Ativo encontrado" (comportamento atual)

3. **Chamadas do `AssetCodeInput`** -- passar `partId`:
   - Na lista de pecas consumidas (PartItem, linha 682): `partId={part.part_id}`
   - No dialog de adicao manual (linha ~460): `partId={selectedPartId}`

### Arquivos Afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/preventivas/ConsumedPartsBlock.tsx` | Refatorar `AssetCodeInput` para receber `partId`, busca parcial filtrada, dropdown de sugestoes |

Nenhuma alteracao de banco de dados ou RLS necessaria.
