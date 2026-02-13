
## Popover de Timeline no Pipeline

### Objetivo
Ao clicar no icone de balao (MessageSquare) no card do pipeline, abrir um Popover inline com a timeline de interacoes e tarefas, sem navegar para outra pagina.

### Abordagem
Usar o componente `Popover` (ja existe em `src/components/ui/popover.tsx`) envolvendo o botao do balao. O conteudo do Popover renderizara o componente `OpportunityTimeline` diretamente.

### Detalhes Tecnicos

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

1. Importar `Popover`, `PopoverTrigger`, `PopoverContent` de `@/components/ui/popover`
2. Importar `OpportunityTimeline` de `@/components/crm/OpportunityTimeline`
3. Substituir o `<button>` atual do MessageSquare por:
   ```
   <Popover>
     <PopoverTrigger asChild>
       <button onClick={(e) => e.stopPropagation()}
         className="p-0.5 rounded hover:bg-accent transition-colors"
         title="Ver interacoes">
         <MessageSquare className="h-3 w-3 text-muted-foreground" />
       </button>
     </PopoverTrigger>
     <PopoverContent
       className="w-80 max-h-96 overflow-y-auto p-3"
       align="end"
       side="left"
       onClick={(e) => e.stopPropagation()}>
       <OpportunityTimeline
         clientProductId={p.id}
         clientId={p.client_id}
         stage={p.stage}
         stageUpdatedAt={p.stage_updated_at}
       />
     </PopoverContent>
   </Popover>
   ```
4. Remover o `useNavigate` e a importacao de `useNavigate` (caso nao seja usado em outro lugar)
5. O `e.stopPropagation()` no trigger e no content evita que o clique acione o `<Link>` pai
6. O Popover tera scroll vertical (`max-h-96 overflow-y-auto`) para timelines longas
7. O `OpportunityTimeline` ja e autossuficiente (busca dados, permite adicionar notas e alternar tarefas), entao funciona direto no Popover sem adaptacoes

### Resultado
- Clique no balao: abre popover com timeline completa (notas, tarefas, marco de ganho)
- Usuario pode adicionar interacoes e alternar status de tarefas sem sair do pipeline
- Clique no card (fora do balao): continua navegando para o cliente normalmente
