
## Redesign do Layout da Timeline de Oportunidades

### Objetivo
Reformular o componente `OpportunityTimeline` para seguir o mesmo estilo visual da timeline de Chamados Tecnicos, com:
- Linha vertical conectando os eventos
- Icones circulares coloridos na lateral
- Layout mais espaçado e profissional
- Botao "Nova Interação" no header (ao inves do textarea sempre visivel)

### Mudancas Visuais

**Layout atual**: Textarea sempre visivel no topo + itens compactos sem linha conectora

**Novo layout (inspirado em Chamados)**:
- Header com titulo "Interações e Tarefas" + botao "+ Nova Interação"
- Clicar no botao abre um campo de texto (toggle)
- Cada item da timeline tem:
  - Icone circular colorido na esquerda (MessageSquare para notas, CheckSquare para tarefas)
  - Linha vertical (`w-px bg-border`) conectando os icones
  - Conteudo a direita com titulo em negrito, detalhes abaixo
  - Data e autor na mesma linha

### Detalhes Tecnicos

**Arquivo: `src/components/crm/OpportunityTimeline.tsx`** (unico arquivo modificado)

1. Adicionar estado `showInput` para controlar visibilidade do campo de nova interação
2. Adicionar header com botao "+ Nova Interação" que alterna `showInput`
3. Reformular a renderizacao dos itens:
   - Cada item envolto em `flex gap-3`
   - Coluna esquerda: icone circular (`h-8 w-8 rounded-full`) + linha vertical (`w-px flex-1 bg-border`)
   - Coluna direita: conteudo com `pb-4` para espaçamento
4. Notas: icone MessageSquare com fundo `bg-blue-100`, titulo "Interação" em negrito, conteudo abaixo, autor e data
5. Tarefas: icone CheckSquare com fundo `bg-amber-100`, titulo da tarefa em negrito, checkbox de status mantido, data de vencimento

### Cores dos icones
- Nota/Interação: `bg-blue-100 text-blue-600`
- Tarefa aberta: `bg-amber-100 text-amber-600`
- Tarefa concluida: `bg-green-100 text-green-600`
