

## Trocar Campo de Digitacao por Lista de Selecao de Ativos

### Contexto

Hoje existem apenas ~10 ativos cadastrados, com no maximo 3 por tipo de peca. Nao ha risco de performance em carregar a lista completa filtrada por peca. Mesmo com crescimento futuro (centenas de ativos), a query filtrada por `omie_product_id` continua leve.

### Mudanca Proposta

Substituir o `AssetCodeInput` (campo de texto com autocomplete) por um **Select** (dropdown) que carrega automaticamente todos os ativos daquela peca, com uma opcao para digitar um codigo novo caso o ativo nao exista ainda.

### Fluxo do Usuario

```text
Tecnico seleciona peca "Pistola DeLaval" (is_asset = true)
Tecnico seleciona origem "Tecnico"
    |
Campo "Cod. Univoco do Ativo" aparece como SELECT
    |
Opcoes carregadas automaticamente:
  - PIST-00123 (disponivel)
  - PIST-00456 (em_uso)
  - PIST-00789 (disponivel)
  - [+ Novo codigo...]
    |
Tecnico seleciona um existente -> campo preenchido
    OU
Tecnico clica "Novo codigo" -> abre input para digitar manualmente
```

### Detalhes Tecnicos

**Alteracoes em `src/components/preventivas/ConsumedPartsBlock.tsx`:**

1. **Refatorar `AssetCodeInput`** para novo componente `AssetCodeSelect`:
   - Props: `value`, `onChange`, `partId`
   - Ao montar, busca todos `workshop_items` com `omie_product_id = partId` (sem limite, sem debounce)
   - Renderiza um `Select` (Radix) com as opcoes
   - Cada opcao mostra `unique_code` e status entre parenteses
   - Ultima opcao fixa: "+ Novo codigo..." que ao ser selecionada mostra um `Input` para digitacao livre
   - Se `partId` nao for fornecido, mostra apenas o input de digitacao livre (fallback)

2. **Estado interno**:
   - `mode`: "select" | "manual"
   - Quando usuario escolhe "+ Novo codigo", muda para mode "manual" e exibe input
   - Botao "Voltar para lista" para retornar ao select

3. **Chamadas do componente** permanecem iguais:
   - No dialog de adicao manual: `partId={selectedPartId}`
   - Na lista de pecas consumidas (PartItem): `partId={part.part_id}`

### Arquivos Afetados

| Arquivo | Alteracao |
|---|---|
| `src/components/preventivas/ConsumedPartsBlock.tsx` | Substituir `AssetCodeInput` por `AssetCodeSelect` com lista carregada e opcao de codigo novo |

Nenhuma alteracao de banco de dados necessaria.
