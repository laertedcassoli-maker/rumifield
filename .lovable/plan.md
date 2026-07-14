# Adicionar escopo "Oficina" ao módulo Inteligência

Hoje o módulo `Inteligência do Cliente` só responde sobre clientes (individual ou "todos"). Vou adicionar um terceiro escopo **Oficina**, com perguntas de volume/lead time, retrabalho, peças e saúde de motores.

## 1. Backend — `supabase/functions/client-intelligence/index.ts`

Novo ramo `scope === "oficina"` (paralelo a `isAll`), que:

- Aceita no body: `scope: "client" | "all" | "oficina"` e um `filters` opcional `{ dateFrom, dateTo, activityType }`. Retrocompat: se `clientId === "all"`, mantém comportamento atual.
- Coleta em paralelo:
  - `work_orders` com `id, code, status, created_at, start_time, end_time, total_time_seconds, activity_id, activities(name, execution_type), work_order_items(workshop_item_id, omie_product_id, quantity), work_order_parts_used(omie_product_id, quantity, pecas(codigo, nome))`, filtrando por período.
  - `workshop_items` com `motor_id not null`: `unique_code, meter_hours_last, motor_replaced_at_meter_hours`.
  - `motor_replacement_history` (últimas 30) com `workshop_item_id, old_motor_code, new_motor_code, motor_hours_used, replaced_at`.
- Calcula `stats_oficina`:
  - Totais por status; lead time médio (created_at→end_time) e distribuição em faixas <30m/30-60m/1-2h/2-4h/>4h das concluídas.
  - Min/max por atividade.
  - Top peças consumidas (soma de `quantity`).
  - Retrabalho: grupos `(workshop_item_id + omie_product_id)` com repetições em ≤90 dias — top 20.
  - Saúde de motores: horas usadas = `meter_hours_last - coalesce(motor_replaced_at_meter_hours, 0)`, classificando vermelho >1000h, laranja >800h. Últimas 10 trocas.
- Monta `fullContext` textual compacto (mesmo padrão do modo cliente) e chama Lovable AI Gateway com `openai/gpt-5.5` (respeitando `model` recebido) e system prompt focado em análise operacional de oficina.

## 2. Frontend — `src/pages/crm/CrmInteligencia.tsx`

- Novo state `scope: "client" | "oficina"` (o modo "Todos" continua dentro do combobox de clientes).
- Adicionar um switch/tabs no topo: **Cliente** | **Oficina**.
- No modo Oficina:
  - Ocultar seletor de cliente; mostrar filtros: date-range (Popover Calendar, mesmo padrão do GestaoOS) e multi-select de atividade (opcional; se vazio = todas).
  - Trocar `SUGGESTIONS_*` por `SUGGESTIONS_OFICINA`:
    - "📈 Volume e lead time do período"
    - "⏱️ Tempo médio por atividade"
    - "🔁 Onde está havendo retrabalho?"
    - "🧩 Peças mais consumidas na oficina"
    - "⚙️ Motores próximos do limite (>800h/>1000h)"
    - "🚨 OS em aberto há mais tempo"
  - Painel de stats: cards com Total OS, Concluídas, Lead time médio, Retrabalho (grupos), Motores em risco, Peças usadas.
- `handleGenerate` envia `{ scope, question, model, filters }`; para `scope === "client"` mantém `clientId`.
- Permissão: reusar `canAccess("crm_inteligencia")` (sem mexer em roles). Sem alteração de RLS.

## 3. Sem migrations

Nenhuma alteração de schema, RLS ou permissões. Apenas leituras (`work_orders`, `workshop_items`, `motor_replacement_history`) que já são acessíveis à role autenticada usada pela edge function (service role).

## Detalhes técnicos

- Reaproveitar helpers existentes (`groupAndCount`, `countByStatus`) e adicionar `groupPartsByCode` para OS.
- Lead time em segundos → formatar horas na string de contexto.
- Limitar retrabalho e listas ao top N para caber no prompt.
- Preservar totalmente o comportamento atual dos escopos Cliente e Todos.
