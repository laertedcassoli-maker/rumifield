
# Unificar ClienteDetail no CrmCliente360 (sem aba Dados)

## Resumo
Migrar a aba **Historico** (timeline unificada de chamados, preventivas e corretivas) do `ClienteDetail.tsx` para o `CrmCliente360.tsx`, usando duas abas: **Produtos** e **Historico**. A rota `/clientes/:id` passara a redirecionar para `/crm/:id`. A aba "Dados Gerais" fica de fora por enquanto.

## Estrutura final

```text
+---------------------------------------------------+
| <- Voltar    Nome do Cliente / Fazenda    [+ Acao] |
| Cidade/UF  |  Telefone  |  Email  |  Consultor    |
+---------------------------------------------------+
| [Produtos]  [Historico]                            |
+---------------------------------------------------+
|  (conteudo da aba selecionada)                     |
+---------------------------------------------------+
```

## Detalhes tecnicos

### 1. Alterar `CrmCliente360.tsx`
- Envolver o conteudo atual (produtos, oportunidades, pendencias, propostas, visitas recentes) em `Tabs` com duas abas: **Produtos** (default) e **Historico**
- Na aba **Historico**, migrar toda a logica do `ClienteDetail.tsx`:
  - Queries de `technical_tickets`, `preventive_maintenance`, `ticket_visits` filtradas por `client_id`
  - Hooks offline (`useOfflineChamados`, `useOfflinePreventivas`, `useOfflineCorretivas`)
  - Cards de resumo clicaveis (Chamados/Preventivas/Corretivas) com filtro interativo
  - Timeline unificada ordenada cronologicamente
  - `TimelineEventModal` para detalhes via iframe
  - Funcoes auxiliares `getStatusLabel` e `getStatusColor`

### 2. Atualizar rotas em `App.tsx`
- Substituir a rota `/clientes/:id` de `<ClienteDetail />` por `<Navigate to="/crm/:id" replace />` (usando um componente wrapper que le o param `id` e redireciona)
- Manter a rota `/clientes` (lista) inalterada

### 3. Atualizar links em `ClientesList.tsx`
- Trocar `to={/clientes/${cliente.id}}` por `to={/crm/${cliente.id}}`

### 4. Limpeza
- O arquivo `ClienteDetail.tsx` pode ser removido apos a migracao
- Remover import de `ClienteDetail` do `App.tsx`
