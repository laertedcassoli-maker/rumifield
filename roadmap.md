# Roadmap

- [x] Agenda de Operações: cor por técnico + filtro por técnico + legenda (validado no preview)
- [ ] Vínculo corretiva↔preventiva "RumiFlow v1":
  - [ ] Investigar template "RumiFlow v1" no banco e reportar nome exato + contagens (ANTES de qualquer migration de dados)
  - [ ] Migration schema: corrective_maintenance + preventive_maintenance_id, contou_como_preventiva; backfill do vínculo pelo padrão CORR-VISIT-
  - [ ] Migration retroativa (SÓ após confirmação do usuário): promover placeholders de visitas concluídas com checklist RumiFlow v1
  - [ ] ExecucaoVisitaCorretiva.tsx: gravar preventive_maintenance_id no check-in; toggle "contou como preventiva?" no encerramento (só RumiFlow v1)
