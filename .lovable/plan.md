

## Corrigir alinhamento do conteudo nos cards de resumo

### Problema
O conteudo (numero + label) dentro dos cards de resumo esta visualmente deslocado para a direita. Isso ocorre porque o componente `CardContent` aplica `p-6` (24px) de padding horizontal por padrao, o que em cards estreitos empurra o conteudo para fora do centro visual.

### Solucao

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

Adicionar `px-2` ao `CardContent` dos cards de resumo para reduzir o padding horizontal, centralizando melhor o conteudo:

```tsx
<CardContent className="py-2 px-2 text-center">
```

Isso substitui o `p-6` padrao do componente por um padding horizontal menor, mantendo o texto centralizado visualmente dentro do card.

