

## Destacar tipo de envio nos pedidos de pecas

### Problema
Os pedidos gerados automaticamente (ex: "Gato do Mato") nao possuem destaque visual que diferencie entre envio fisico e apenas emissao de NF. O tipo de envio aparece apenas como um icone pequeno, sem texto.

### Solucao escolhida: Tags visuais + Filtro

Combinar duas melhorias: (1) badges/tags visualmente claras no card e (2) filtro na listagem.

---

### 1. Tags visuais no PedidoCard (Kanban e Lista)

Adicionar badges coloridas e explicitas para `tipo_envio`:

| tipo_envio | Badge | Cor |
|---|---|---|
| envio_fisico | "Envio Fisico" com icone Truck | Azul (destaque normal) |
| apenas_nf | "Apenas NF" com icone FileText | Amarelo/Amber (destaque de atencao) |
| correio | "Correio" com icone Truck | Cinza |
| entrega | "Entrega" com icone HandHelping | Cinza |

A badge de "Apenas NF" tera cor amarela para chamar atencao de que nao ha envio fisico.

### 2. Filtro por tipo de envio na aba "Pedidos"

Adicionar um filtro com as opcoes:
- **Todos** (padrao)
- **Envio Fisico** (correio, entrega, envio_fisico)
- **Apenas NF** (apenas_nf)

Isso permite ao admin rapidamente separar o que precisa ser despachado do que e so faturamento.

---

### Detalhes tecnicos

**Arquivo `src/components/pedidos/PedidoKanban.tsx`**:
- Adicionar `envio_fisico` no `tipoEnvioIcons` e `tipoEnvioLabels`
- Criar config de cores para tipo_envio (similar ao `urgenciaConfig`)
- Substituir o `<span>` do tipo_envio por um `<Badge>` colorido com texto visivel

**Arquivo `src/pages/Pedidos.tsx`**:
- Adicionar `envio_fisico` nos mapeamentos de tipo_envio existentes
- Adicionar estado `tipoEnvioFilter` com opcoes 'all' | 'envio' | 'apenas_nf'
- Aplicar filtro no `filteredAndSortedPedidos`
- Renderizar botoes/select de filtro na area de filtros existente
- Na tabela de listagem, exibir a badge de tipo_envio na coluna existente

