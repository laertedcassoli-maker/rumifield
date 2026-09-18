# Roadmap

- [x] Visita Técnica: nova tela listando visitas corretivas (ticket_visits) + preventivas (preventive_route_items), filtro Todos/Corretivas/Preventivas, navegação aos detalhes existentes, rota /visita-tecnica — validado no preview (38 corretivas + 66 preventivas, filtro e navegação OK)
- [x] Menu: "Novas Instalações" com ícone House; ordem em "Instalações Existentes": Preventivas → Chamados → Visita Técnica → Clientes

- [x] Migration idempotente documentando retroativo corretiva→preventiva — aplicada; 0 linhas pendentes (idempotência confirmada)
- [x] Agenda: cores pastéis fixas (Lenilton/Phelipe/Roger) antes do hash — validado no preview
- [x] Agenda: ocultar etapas só-CSM (hook filtra technician_user_id) + distinção de grupo por cantos quadrados/arredondados e legenda atualizada — validado no preview
- [x] Preventiva: excluir estoque_interno em Calendario/Index/NovaRota + view client_preventive_overview — aplicado e validado (view com security_invoker + grants, linter de volta aos 53 avisos padrão)
- [x] Instalações: 'pre_venda' removido de STAGE_ORDER/STAGE_LABELS — Playwright confirma ausência com e sem filtro
- [x] Instalações: upload/substituição de "E-mail de venda" na execução de Pré Instalação — testado e2e (toast, substituição, read-only após aprovação)
- [x] Instalações: resumo de contagem por situação no topo da listagem — Total/Concluídas/Em Pré Instalação/Em Instalação/Sem etapa
- [x] Menu Administração: "Usuários" virou submenu colapsável com Usuários + Permissões (gate por qualquer um dos dois permKeys)
- [x] Agenda de Operações: cor por técnico + filtro por técnico + legenda (validado no preview)
- [x] Vínculo corretiva↔preventiva "RumiFlow v1":
  - [x] Template "RumiFlow v1" confirmado (id 3b86c956-...); 28 concluídas, 2 em andamento, 33 placeholders
  - [x] Migration schema: corrective_maintenance + preventive_maintenance_id, contou_como_preventiva
  - [x] Retroativo aprovado e aplicado: 33 vínculos, 28 preventivas promovidas (elegibilidade já reflete)
  - [x] ExecucaoVisitaCorretiva.tsx: grava preventive_maintenance_id no check-in; toggle "contou como preventiva?" no encerramento (só RumiFlow v1) — validado por typecheck/build; dialogo e2e não alcançável no preview (botão Encerrar desabilitado até checklist completo)
- [x] Agenda: prefixo de ícone 🏗️/🔧 no título dos eventos + legenda (mantém border-radius) — validado no preview
- [x] Renomear item Admin "Envios" -> "Envios Químicos" (AppSidebar, AppLayout pageTitles) e título da página Envios.tsx — validado no preview
- [x] Carteira CRM: filtro por produto ativo (Select "Todos os produtos" + 5 produtos, filtra activeProducts) — validado no preview (81 -> 57 com RumiFlow)
- [x] Trocar ícone de "Novas Instalações" de House para Construction (lucide-react) — validado no preview
- [x] Ícone comum engrenagem + selo NEW (NewGearIcon) em "Novas Instalações" e item filho "Instalação" — validado no preview
