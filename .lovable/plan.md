

## Limpar dados de "Minhas Rotas"

A tela "Minhas Rotas" (`src/pages/preventivas/MinhasRotas.tsx`) lista preventivas atribuídas ao técnico, vindas da tabela `preventive_maintenance`, agrupadas por rota (`preventive_routes` + `preventive_route_items`).

Para "limpar tudo" preciso apagar em cascata para não deixar órfãos:

1. **`preventive_maintenance_consumed_parts`** — peças consumidas durante execuções
2. **`preventive_checklist_executions`** + itens (`preventive_checklist_execution_items`, ações, mídias, observações)
3. **`preventive_visit_media`** — mídias da visita
4. **`preventive_maintenance`** — as visitas em si
5. **`preventive_route_items`** — fazendas vinculadas às rotas
6. **`preventive_routes`** — as rotas

Também removo qualquer **pedido de peças (SP)** que tenha sido gerado a partir dessas execuções, se houver vínculo direto, para evitar inconsistência.

### Etapas

1. **Inspeção rápida** (via insert tool / read query) — contar registros atuais em cada tabela para reportar volume removido.
2. **DELETE em ordem reversa de dependência** — execução em uma única transação na ordem listada acima.
3. **Confirmação** — informar quantos registros foram apagados em cada tabela.

### Fora do escopo

- **Não apago** templates de checklist (`checklist_templates`, blocos, itens, ações) — são configuração reutilizável.
- **Não apago** clientes/fazendas.
- **Não apago** chamados técnicos, visitas CRM, ordens de serviço de oficina ou pedidos de peças não relacionados a preventivas.
- **Não mexo** em código — apenas dados.

### Observação importante

Esta operação é **destrutiva e irreversível**. Após aprovação, todos os históricos de rotas e execuções preventivas serão removidos. Templates e clientes permanecem intactos, então o módulo continua 100% funcional para criar novas rotas.

