

## Melhorias na Timeline de Oportunidades

### 1. Contador de registros no trigger do Collapsible

Tanto nos cards de produto quanto nos cards de oportunidade, o botao "Interacoes & Tarefas" passara a mostrar a contagem de registros. Exemplo: **"Interacoes & Tarefas (5)"**.

Para isso, usaremos os dados de `noteCounts` que ja sao buscados no `CrmCliente360.tsx`, combinados com as tarefas vinculadas. Precisaremos tambem buscar o count de tarefas por `client_product_id` para ter o total correto.

### 2. Indicador de oportunidade "fria" (>15 dias sem interacao)

No trigger do Collapsible, quando a ultima interacao tiver mais de 15 dias, exibiremos um badge/indicador vermelho (ex: icone de alerta ou badge "15d+") ao lado do contador. Isso ja e calculado parcialmente no bloco de Oportunidades; vamos replicar a mesma logica para os cards de produto `em_negociacao`.

### 3. Timeline visivel para produtos com estagio "ganho"

Atualmente a timeline so aparece para `em_negociacao`. Vamos expandir para mostrar tambem quando o estagio e `ganho`, permitindo consultar o historico de interacoes e tarefas que levaram ao fechamento. A timeline ficara em modo somente-leitura para `ganho` (sem botao "Nova Interacao").

---

### Detalhes Tecnicos

**Arquivo: `src/pages/crm/CrmCliente360.tsx`**

1. Alterar a condicao `isNegociacao` para `isNegociacao || isGanho` (onde `isGanho = cp.stage === 'ganho'`), mostrando o Collapsible da timeline tambem para ganho
2. Adicionar contagem no texto do `CollapsibleTrigger`: usar `noteCount` + count de tarefas do produto
3. Buscar tambem o count de tarefas por `client_product_id` (nova query ou expandir a query existente `crm-opportunity-notes-counts` para incluir tasks)
4. Calcular `daysSinceLastInteraction` por produto e mostrar badge vermelho no trigger quando > 15 dias
5. Passar uma prop `readOnly` para `OpportunityTimeline` quando o estagio for `ganho`

**Arquivo: `src/components/crm/OpportunityTimeline.tsx`**

1. Adicionar prop `readOnly?: boolean`
2. Quando `readOnly=true`, ocultar o botao "Nova Interacao" e desabilitar toggle de status das tarefas

**Query adicional ou expandida em `CrmCliente360.tsx`**:
- Expandir a query `crm-opportunity-notes-counts` para tambem buscar `crm_actions` por `client_product_id` e contar, alem de pegar a data mais recente entre notas e tarefas para calcular dias sem interacao.
