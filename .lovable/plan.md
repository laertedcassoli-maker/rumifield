
## Adicionar Data de "Ganho" na Timeline de Oportunidades

### Objetivo
Quando um produto muda para o estágio "Ganho", exibir a data exata dessa transição na timeline como um item especial (ex: "Ganho em 13/02/2026") para contextualizar o histórico de interações.

### Análise Atual
- A data `stage_updated_at` já é registrada quando um produto muda de estágio (em `AtualizarNegociacaoModal.tsx`)
- A timeline atualmente mostra apenas **notas** (crm_opportunity_notes) e **tarefas** (crm_actions)
- O componente `OpportunityTimeline` recebe o `clientProductId` mas não tem acesso ao `stage` ou `stage_updated_at` do produto
- Para produtos em estágio "ganho", a timeline já renderiza em modo `readOnly`

### Solução Proposta

**1. Passar informações do estágio para a timeline**
- Modificar `OpportunityTimeline` para receber props adicionais:
  - `stage`: o estágio atual do produto (ex: 'ganho', 'perdido')
  - `stageUpdatedAt`: a data em que o estágio foi atualizado
- Em `CrmCliente360.tsx`, passar esses dados ao renderizar `OpportunityTimeline`:
  ```tsx
  <OpportunityTimeline 
    clientProductId={cp.id} 
    clientId={id!} 
    readOnly={isGanho}
    stage={cp.stage}
    stageUpdatedAt={cp.stage_updated_at}
  />
  ```

**2. Adicionar item de transição de estágio na timeline**
- Expandir a interface `TimelineItem` para incluir um tipo `'stage_change'`
- Quando `stage === 'ganho'` e `stageUpdatedAt` existe, criar um item fictício representando o fechamento
- Este item aparecerá no topo da timeline (mais recente) com:
  - Ícone especial (ex: `Trophy` ou `Check` em verde)
  - Rótulo "Ganho" em negrito
  - Data formatada: "Ganho em dd/MM/yyyy"
  - Fundo `bg-green-100 text-green-600`

**3. Implementação técnica**

**Arquivo: `src/components/crm/OpportunityTimeline.tsx`**
- Expandir `TimelineItem` interface:
  ```tsx
  interface TimelineItem {
    id: string;
    type: 'note' | 'task' | 'stage_change';
    created_at: string;
    content?: string;
    user_name?: string;
    title?: string;
    description?: string;
    status?: 'aberta' | 'concluida';
    due_at?: string | null;
    priority?: number;
    stageLabel?: string;  // "Ganho", "Perdido", etc
  }
  ```
- Adicionar props:
  ```tsx
  interface OpportunityTimelineProps {
    clientProductId: string;
    clientId: string;
    readOnly?: boolean;
    stage?: string;           // novo
    stageUpdatedAt?: string;  // novo
  }
  ```
- Antes de retornar a timeline, adicionar item de transição de estágio se aplicável:
  ```tsx
  const timeline: TimelineItem[] = [
    // Se stage é ganho, adicionar item de fechamento no topo
    ...(stage === 'ganho' && stageUpdatedAt ? [{
      id: `${clientProductId}-ganho`,
      type: 'stage_change',
      created_at: stageUpdatedAt,
      stageLabel: 'Ganho',
    }] : []),
    // Depois as notas e tarefas existentes
    ...(notes || []).map(...),
    ...(tasks || []).map(...),
  ].sort((a, b) => ...);
  ```
- Na renderização, adicionar lógica para `type === 'stage_change'`:
  ```tsx
  const isDone = item.type === 'stage_change';
  const iconBg = isDone 
    ? 'bg-green-100 text-green-600'
    : isNote 
      ? 'bg-blue-100 text-blue-600'
      : isDone 
        ? 'bg-green-100 text-green-600'
        : 'bg-amber-100 text-amber-600';
  ```
  - Usar ícone `Trophy` ou `CheckCircle2` em verde para stage_change
  - Exibir: "Ganho em 13/02/2026"

**Arquivo: `src/pages/crm/CrmCliente360.tsx`**
- Passar `stage` e `stage_updated_at` ao componente:
  ```tsx
  <OpportunityTimeline 
    clientProductId={cp.id} 
    clientId={id!} 
    readOnly={isGanho}
    stage={cp.stage}
    stageUpdatedAt={cp.stage_updated_at}
  />
  ```

### Resultado Visual
Para um produto em estágio "Ganho":
1. Primeiro item: ✅ **Ganho em 13/02/2026** (verde)
2. Depois: Todas as interações e tarefas históricas em ordem cronológica reversa

### Benefícios
- Contexto claro de quando o negócio foi fechado
- Marca visual clara do ponto de conclusão
- Facilita análise do ciclo de vendas (quanto tempo levou do primeiro contato ao fechamento)
