

## Adicionar ordenação configurável na tela Minhas Rotas

### O que será feito

Adicionar um seletor de ordenação ("Ordenar por") ao bloco de filtros, permitindo ao usuário escolher entre 4 critérios de ordenação:

- **Status** (padrão atual — prioriza em_elaboração, em_execução, planejada, etc.)
- **Data de criação** (mais recentes primeiro)
- **Tipo** (Preventivas primeiro ou Corretivas primeiro)
- **Técnico** (ordem alfabética pelo nome)

### Alterações em `src/pages/preventivas/MinhasRotas.tsx`

1. **Novo estado `sortBy`**: Criar um state `sortBy` com tipo `'status' | 'data_criacao' | 'tipo' | 'tecnico'`, default `'status'`.

2. **Novo seletor no bloco de filtros**: Adicionar um `<Select>` com ícone `ArrowUpDown` (lucide) logo abaixo do filtro de status e antes do filtro de técnico. Label: "Ordenar por".

3. **Refatorar o `.sort()` no `useMemo`**: Em vez de usar a lógica fixa atual (data primária + status secundário), o comparator vai escolher o critério primário com base em `sortBy`:
   - `'status'`: prioridade de status → data criação desc → id
   - `'data_criacao'`: dia local desc → status → id
   - `'tipo'`: preventive antes de corrective (ou vice-versa) → data desc → id
   - `'tecnico'`: nome do técnico asc → data desc → id

4. **Adicionar `sortBy` às dependências do `useMemo`**.

### Layout visual

O seletor ficará na mesma área dos filtros existentes, como um `<Select>` full-width igual ao de status, mantendo consistência visual.

### O que NÃO muda

- Filtros existentes (tipo, período, status, técnico)
- Layout dos cards
- Exibição de "Criada em"
- Normalização de status de corretivas

