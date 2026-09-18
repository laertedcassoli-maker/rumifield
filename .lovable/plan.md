# Agenda de Operações

Nova tela de calendário (dia/semana/mês) mostrando, em um só lugar, todos os agendamentos de campo: Pré Instalação/Instalação, visitas corretivas e preventivas. Tela somente leitura — clicar num agendamento leva direto à tela de origem.

## O que o usuário verá

- Novo item "Agenda de Operações" no topo do Menu Principal, disponível para Admin, Coordenador R+, Coordenador de Serviços, Coordenador de Logística e Consultor R+.
- Calendário com os botões padrão de navegação e as visões Mês / Semana / Dia.
- Cada agendamento aparece como "Fazenda — Nome do responsável", com cor distinta por grupo:
  - Novas Instalações (Pré Instalação, Instalação)
  - Instalações Existentes (visitas corretivas e preventivas)
- Filtro no topo: Todos / Novas Instalações / Instalações Existentes (mesmo estilo de botões já usado em Solicitação de Peças).
- Um clique no agendamento abre a tela de origem correspondente.

## Fontes de dados (confirmadas no banco)

| Origem | Data | Responsável | Cliente | Destino do clique |
| --- | --- | --- | --- | --- |
| `installation_stages` (`stage` pre_instalacao/instalacao) | `planned_date` | `technician_user_id` ou `csm_user_id` | via `installations.cliente_id` | `/instalacoes/etapa/:stageId` |
| `ticket_visits` | `planned_start_date` | `field_technician_user_id` | `client_id` | `/chamados/visita/:visitId` |
| `preventive_route_items` | `planned_date` | `preventive_routes.field_technician_user_id` | `client_id` | `/preventivas/execucao/:routeId/atendimento/:itemId` |

Registros sem data são ignorados; status cancelado/cancelada é excluído.

Volume atual: ~40 agendamentos no total, então a agenda carrega tudo de uma vez (sem janela por mês). Se o volume crescer muito, adicionar depois um recorte por período.

## Detalhes técnicos

- Dependências: `@fullcalendar/react`, `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/list` (linha 6.x, compatível com React 18.3).
- `src/hooks/useAgendaOperacoes.ts`: três `useQuery` independentes (uma por fonte) + enriquecimento de nomes via `profiles` e `clientes`, compostas num array único de `AgendaEvento { id, titulo, data, tecnicoNome, clienteNome, fazenda, grupo, tipo, linkTo }`.
- `src/pages/AgendaOperacoes.tsx`: FullCalendar com `dayGridMonth` / `timeGridWeek` / `timeGridDay`, locale pt-BR, `eventClick` → `navigate(linkTo)`, eventos como all-day (as fontes têm apenas data). Filtro de grupo em estado local.
- `AppSidebar.tsx`: novo item em `mainMenuItems` com `permKey: 'agenda_operacoes'` e ícone `CalendarDays`.
- Migration: seed em `role_menu_permissions` (`menu_key='agenda_operacoes'`, grupo `principal`) com `can_access=true` para os 5 papéis listados, usando o mesmo `ON CONFLICT (role, menu_key) DO UPDATE` das migrations anteriores.
- Rota `/agenda-operacoes` dentro de `AppLayout` em `App.tsx`.
- Sem mudanças de schema, RLS, telas de origem ou outros itens de menu.
