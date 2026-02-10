

## Consumo automático de peças condicionado a ação "Troca"

### Contexto atual
Hoje, ao selecionar uma Não Conformidade (NC) que tem peças associadas, o sistema automaticamente cria registros de consumo de peças (`preventive_part_consumption`). A ação corretiva selecionada não influencia esse comportamento.

### Nova regra
O consumo automático de peças só deve ocorrer quando **ambas** as condições forem atendidas:
1. Uma NC com peças associadas estiver selecionada
2. Uma ação corretiva contendo a palavra **"Troca"** (case-insensitive) estiver selecionada para o mesmo item

### Mudanças necessárias

**Arquivo:** `src/components/preventivas/ChecklistExecution.tsx`

#### 1. Ao selecionar uma NC (toggleNonconformityMutation)
- Antes de criar registros de consumo de peças (linhas ~608-644), verificar se o item já possui alguma ação corretiva selecionada cujo label contenha "troca" (case-insensitive)
- Se não houver ação "Troca" selecionada, **não** inserir peças no consumo (apenas registrar a NC normalmente)
- Se houver, manter o comportamento atual de inserir peças

#### 2. Ao selecionar uma Ação Corretiva (toggleActionMutation)
- Quando uma ação contendo "Troca" for **selecionada** (adicionada):
  - Verificar se o item possui NCs selecionadas que tenham peças associadas
  - Se sim, buscar as peças de cada NC e criar os registros de consumo (mesma lógica que hoje existe no toggle de NC)
- Quando uma ação contendo "Troca" for **desmarcada** (removida):
  - Remover todos os registros de consumo automático (não manuais) associados às NCs daquele item

#### 3. Ao remover uma NC (toggleNonconformityMutation - ramo isSelected)
- Manter o comportamento atual: remover as peças de consumo associadas àquela NC (independentemente de haver "Troca" ou não, pois a NC foi removida)

### Detalhes Técnicos

A verificação de ações "Troca" será feita consultando as ações selecionadas do item no checklist existente em memória (`existingChecklist`), comparando `action_label_snapshot.toLowerCase().includes('troca')`.

Para o toggle de ação, será necessário:
- Buscar as NCs selecionadas do item via `preventive_checklist_item_nonconformities`
- Para cada NC, buscar peças associadas via `checklist_nonconformity_parts`
- Criar/remover registros em `preventive_part_consumption` usando upsert com `onConflict` (mesmo padrão existente)

A lógica de limpeza ao mudar status de N para S/NA (linhas 410-440) permanece inalterada, pois já remove tudo.

