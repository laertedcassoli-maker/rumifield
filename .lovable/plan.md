

## Renomear Propostas para Oportunidades e Adicionar Interacoes

### O que sera feito

1. **Renomear** a secao "Propostas" para "Oportunidades" no titulo e contagem
2. **Adicionar Collapsible** com interacoes abaixo de cada card de proposta/oportunidade, reutilizando o componente `OpportunityNotes` e os dados de `noteCounts` ja carregados

### Detalhes Tecnicos

**Arquivo: `src/pages/crm/CrmCliente360.tsx`**

- Alterar o titulo `Propostas ({proposals.length})` para `Oportunidades ({proposals.length})`
- Envolver cada card de proposta em um `div` com `className="space-y-0"` (mesmo padrao dos produtos)
- Adicionar `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` abaixo de cada card
- Usar `p.client_product_id` para passar ao `OpportunityNotes` e buscar contagem em `noteCounts`

### Arquivo a modificar
- `src/pages/crm/CrmCliente360.tsx` -- unico arquivo afetado

