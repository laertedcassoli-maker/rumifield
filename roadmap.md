# Roadmap

- [x] Migration idempotente documentando retroativo corretiva→preventiva — aplicada; 0 linhas pendentes (idempotência confirmada)
- [x] Agenda: cores pastéis fixas (Lenilton/Phelipe/Roger) antes do hash — validado no preview
- [ ] Preventiva: excluir estoque_interno em Calendario/Index/NovaRota + view client_preventive_overview — frontend aplicado, migration aplicada (corrigir security_invoker da view)
- [ ] Instalações: remover 'pre_venda' de STAGE_ORDER/STAGE_LABELS (Index.tsx)
- [ ] Instalações: upload/substituição de "E-mail de venda" na execução de Pré Instalação (ExecucaoEtapa.tsx)
- [ ] Instalações: resumo de contagem por situação no topo da listagem (Index.tsx, sem nova query, ignora filtro ?etapa=)
- [x] Menu Administração: "Usuários" virou submenu colapsável com Usuários + Permissões (gate por qualquer um dos dois permKeys)
- [x] Agenda de Operações: cor por técnico + filtro por técnico + legenda (validado no preview)
- [x] Vínculo corretiva↔preventiva "RumiFlow v1":
  - [x] Template "RumiFlow v1" confirmado (id 3b86c956-...); 28 concluídas, 2 em andamento, 33 placeholders
  - [x] Migration schema: corrective_maintenance + preventive_maintenance_id, contou_como_preventiva
  - [x] Retroativo aprovado e aplicado: 33 vínculos, 28 preventivas promovidas (elegibilidade já reflete)
  - [x] ExecucaoVisitaCorretiva.tsx: grava preventive_maintenance_id no check-in; toggle "contou como preventiva?" no encerramento (só RumiFlow v1) — validado por typecheck/build; dialogo e2e não alcançável no preview (botão Encerrar desabilitado até checklist completo)
