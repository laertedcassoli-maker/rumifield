# Roadmap

- [x] Migration idempotente documentando retroativo corretiva→preventiva — aplicada; 0 linhas pendentes (idempotência confirmada)
- [x] Agenda: cores pastéis fixas (Lenilton/Phelipe/Roger) antes do hash — validado no preview
- [x] Menu Administração: "Usuários" virou submenu colapsável com Usuários + Permissões (gate por qualquer um dos dois permKeys)
- [x] Agenda de Operações: cor por técnico + filtro por técnico + legenda (validado no preview)
- [x] Vínculo corretiva↔preventiva "RumiFlow v1":
  - [x] Template "RumiFlow v1" confirmado (id 3b86c956-...); 28 concluídas, 2 em andamento, 33 placeholders
  - [x] Migration schema: corrective_maintenance + preventive_maintenance_id, contou_como_preventiva
  - [x] Retroativo aprovado e aplicado: 33 vínculos, 28 preventivas promovidas (elegibilidade já reflete)
  - [x] ExecucaoVisitaCorretiva.tsx: grava preventive_maintenance_id no check-in; toggle "contou como preventiva?" no encerramento (só RumiFlow v1) — validado por typecheck/build; dialogo e2e não alcançável no preview (botão Encerrar desabilitado até checklist completo)
