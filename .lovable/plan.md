
## Melhorias na Tela de Pipeline

### 1. Atalho para Interacoes no card de oportunidade

Adicionar um botao/icone de "balao de mensagem" no card do pipeline que, ao clicar, navega para a pagina do cliente com a timeline ja aberta (ou abre um Popover/Sheet com a timeline inline).

**Abordagem escolhida**: Navegar para `/crm/{client_id}` com um state adicional `openTimeline: productId`, que o `CrmCliente360` usara para abrir automaticamente o Collapsible da timeline daquele produto. O botao sera um icone `MessageSquare` no card, com `e.preventDefault()` + `e.stopPropagation()` para nao conflitar com o Link pai.

### 2. Destacar oportunidades frias (>15 dias sem interacao)

Buscar a data da ultima interacao (notas + tarefas) por `client_product_id` no `usePipelineData` e calcular quantos dias se passaram. No card, exibir indicador vermelho (borda ou badge) quando >15 dias.

**Dados necessarios**: Nova query no `usePipelineData` buscando o MAX(created_at) de `crm_opportunity_notes` e `crm_actions` agrupado por `client_product_id`. Calcular `daysSince` no frontend.

### 3. Valor total por etapa nos contadores

Somar `value_estimated` de todas as oportunidades em cada etapa e exibir abaixo da contagem.

---

### Detalhes Tecnicos

**Arquivo: `src/hooks/useCrmData.ts` (funcao `usePipelineData`)**

- Adicionar nova query para buscar ultima interacao por produto:
  ```sql
  -- crm_opportunity_notes: MAX(created_at) GROUP BY client_product_id
  -- crm_actions: MAX(created_at) GROUP BY client_product_id
  ```
- Duas queries separadas (notas e acoes), depois merge no frontend para obter a data mais recente por produto
- Retornar um Map `lastInteractionByProduct: Record<string, string>` no hook

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

1. **Contadores com valor total**:
   - Calcular `totalValue` por stage somando `value_estimated` dos itens do grupo
   - Exibir abaixo da contagem: `R$ 123.456` em texto menor

2. **Card com indicador de frio**:
   - Usar `lastInteractionByProduct[p.id]` para calcular dias
   - Se >15 dias: borda vermelha no card (`border-red-300`) + badge "Xd" em vermelho
   - Se sem interacoes e stage nao e `nao_qualificado`: tambem destacar

3. **Botao de atalho para timeline**:
   - Adicionar icone `MessageSquare` ao lado do `ChevronRight`
   - Usar `useNavigate` para navegar com state `{ from: '/crm/pipeline', fromLabel: 'Pipeline', openTimeline: p.id }`
   - `onClick` com `e.preventDefault()` e `e.stopPropagation()` para nao acionar o Link pai

**Arquivo: `src/pages/crm/CrmCliente360.tsx`**

- Ler `location.state?.openTimeline` e usar como valor inicial dos Collapsibles abertos
- Se o `openTimeline` bater com um `clientProductId`, iniciar aquele Collapsible como aberto

### Resultado Visual

**Contadores**:
```
  12          5          3          8          2
Nao Qual.  Qualif.  Em Negoc.   Ganho    Perdido
R$ 45.000  R$ 120k  R$ 89.000  R$ 340k  R$ 15.000
```

**Card frio**:
- Borda vermelha sutil
- Badge "18d" em vermelho no canto do card

**Card com atalho**:
- Icone de balao de mensagem clicavel ao lado da seta
