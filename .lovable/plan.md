

## Adicionar opção "Todos os clientes" na Inteligência do Cliente

### Problema
Atualmente a tela de Inteligência do Cliente exige a seleção de um cliente específico. O usuário quer poder fazer perguntas sobre **todos os clientes** de uma vez (ex: "Quais clientes estão com preventivas atrasadas?", "Resumo geral de chamados abertos").

### Abordagem

A edge function `client-intelligence` faz ~10 queries filtradas por `client_id`. Para "Todos", precisamos de uma versão agregada que não filtre por cliente, mas traga dados resumidos.

### Alterações

**1. Frontend — `CrmInteligencia.tsx`**
- Adicionar uma opção fixa "Todos os clientes" no ComboBox (antes da lista de clientes)
- Quando selecionado, enviar `clientId: "all"` para a edge function
- Ajustar a validação e o label exibido
- Ocultar o painel de stats detalhado (não faz sentido para "todos") ou adaptar com métricas agregadas
- Adicionar sugestões específicas para visão geral (ex: "Quais clientes precisam de atenção?", "Resumo de chamados abertos por cliente")

**2. Edge Function — `client-intelligence/index.ts`**
- Detectar `clientId === "all"`
- Nesse caso, fazer queries agregadas:
  - Total de clientes ativos
  - Preventivas por status (sem filtro de cliente), agrupadas
  - Chamados abertos (todos), com nome do cliente
  - Produtos CRM por estágio (pipeline geral)
  - Pedidos pendentes por cliente
- Montar um prompt diferente para a IA: contexto de "visão geral de todos os clientes" em vez de cliente específico
- Limitar dados para não estourar o contexto do modelo (top 20 clientes com mais pendências, etc.)

**3. Sugestões para "Todos"**
Quando "Todos os clientes" estiver selecionado, trocar os chips de sugestão para perguntas como:
- "Quais clientes precisam de atenção urgente?"
- "Resumo de chamados abertos por cliente"
- "Quais clientes estão com preventivas atrasadas?"
- "Visão geral do pipeline comercial"

### Riscos
- Volume de dados: queries sem filtro de cliente podem ser pesadas. Mitigar com `limit` e agregações no SQL.
- Contexto do modelo: prompt pode ficar grande. Resumir dados antes de enviar.

