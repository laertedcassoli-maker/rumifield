
## Dashboard "Minha Carteira" - Indicadores CRM

### Objetivo
Criar uma pagina de dashboard com KPIs consolidados da carteira do consultor logado, oferecendo visao rapida de cobertura de visitas, qualificacao e ativacao por produto. Admins e Coordenadores R+ veem dados globais com filtro por consultor.

### Indicadores planejados

1. **Cobertura de Visitas (30d)** - % de clientes ativos que receberam ao menos 1 visita concluida nos ultimos 30 dias (baseado em `crm_visits.status = 'concluida'` e `checkout_at` nos ultimos 30 dias)

2. **Qualificacao por Produto** - Para cada um dos 5 produtos, % de clientes cujo estagio e `qualificado` ou superior (qualificado, proposta, negociacao, ganho) vs total de clientes

3. **Ativacao por Produto** - Para cada um dos 5 produtos, % de clientes com estagio `ganho` vs total de clientes

4. **Resumo geral** - Total de clientes, total de acoes pendentes, total de acoes vencidas

### Layout da pagina

```text
+------------------------------------------+
| Minha Carteira          [Filtro Consultor]|  <- filtro so para admin/coord
+------------------------------------------+
| [Card] Clientes  [Card] Visitas 30d      |
| [Card] Pendencias [Card] Vencidas        |
+------------------------------------------+
| Ativacao por Produto                     |
| [===== barra Ideagri 40% ============]  |
| [===== barra RumiFlow 25% ===========]  |
| [===== barra OnFarm 60% =============]  |
| [===== barra RumiAction 15% =========]  |
| [===== barra RumiProcare 30% ========]  |
+------------------------------------------+
| Qualificacao por Produto                 |
| (mesma estrutura de barras)              |
+------------------------------------------+
```

### Alteracoes tecnicas

**1. Nova pagina: `src/pages/crm/CrmDashboard.tsx`**

- Reutiliza o hook `useCarteiraData()` que ja busca clientes, `crm_client_products`, snapshots, actions e visits
- Adiciona query para visitas concluidas nos ultimos 30 dias (`crm_visits` com `status = 'concluida'` e `checkout_at >= now() - 30 days`)
- Para admin/coord: busca lista de consultores (`profiles`) e exibe Select de filtro
- Calcula todos os KPIs no `useMemo` filtrando pelo consultor selecionado (ou todos se nenhum filtro)
- Usa componentes existentes: `Card`, `Progress`, `Select`, `Skeleton`
- Barras de progresso com o componente `Progress` existente e labels de percentual

**2. Rota no `src/App.tsx`**

- Adicionar rota `/crm/dashboard` com `CrmDashboard` dentro de `AppLayout`

**3. Menu lateral: `src/components/layout/AppSidebar.tsx`**

- Adicionar item "Dashboard CRM" com icone `BarChart3` (ou `PieChart`) na posicao antes de "CRM Carteira", usando `permKey: 'crm_clientes'`

**4. Hook de dados (sem alteracao no hook existente)**

- O `useCarteiraData()` ja retorna todos os dados necessarios (clientes com `consultor_rplus_id`, `clientProducts` com `stage`, visits planejadas)
- Apenas uma query adicional sera feita diretamente na pagina para buscar visitas concluidas nos ultimos 30 dias (a query atual so busca planejadas)
- Lista de consultores: reutiliza o mesmo padrao de `usePipelineData` (query em `profiles`)

**5. Logica de filtro por consultor**

- Admin/Coord: Select com todos os consultores + opcao "Todos"
- Consultor: sem filtro, ve apenas sua carteira (filtragem pelo `consultor_rplus_id` do cliente, mesmo padrao da Carteira)

### Calculo dos KPIs

- **Cobertura Visitas 30d**: clientes com pelo menos 1 visita concluida (checkout_at >= 30d atras) / total clientes ativos
- **Qualificacao produto X**: clientes com estagio in (qualificado, proposta, negociacao, ganho) para produto X / total clientes
- **Ativacao produto X**: clientes com estagio = ganho para produto X / total clientes
- **Pendencias**: soma de acoes com status != concluida
- **Vencidas**: soma de acoes com status != concluida e due_at < now()

### Nao requer alteracoes no banco de dados
Todos os dados necessarios ja existem nas tabelas `clientes`, `crm_client_products`, `crm_visits` e `crm_actions`.
