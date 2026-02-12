

## Simplificar Pipeline: Remover Abas e Usar Botoes de Produto

### O que sera feito

**1. Remover sistema de abas (Tabs)**
- Eliminar as abas Pipeline, Consultores e Resumo
- Manter apenas o conteudo do Pipeline (contadores por etapa + kanban)
- Remover codigo morto: `consultorSummary`, `avgDays`, `topLoss` e imports nao utilizados (Tabs, CardHeader, CardTitle)

**2. Substituir Select de produto por botoes toggle**
- Linha de botoes compactos: "Todos", "Ideagri", "RumiFlow", "OnFarm", etc.
- Botao selecionado fica com destaque visual (variante `default`), os demais ficam `outline`
- Manter filtro de consultor como Select (apenas para admins)

### Detalhes Tecnicos

**`src/pages/crm/CrmPipeline.tsx`**
- Remover imports: `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `CardHeader`, `CardTitle`
- Adicionar import: `Button` de `@/components/ui/button`
- Substituir o `Select` de produto por uma row de `Button` com `variant={selectedProduct === code ? 'default' : 'outline'}` e `size="sm"`
- Remover todo o bloco `<Tabs>` e renderizar diretamente os contadores + kanban
- Remover `useMemo` de `consultorSummary`, `topLoss` e funcao `avgDays`
- Remover import de `lossReasons` do hook (se nao usado em mais nada)

**Layout dos botoes de produto:**
```text
[Todos] [Ideagri] [RumiFlow] [OnFarm] [RumiAction] [RumiProcare]
```
Usando `flex flex-wrap gap-1.5` para responsividade em mobile.

### Arquivos a modificar
- `src/pages/crm/CrmPipeline.tsx` - unico arquivo afetado
