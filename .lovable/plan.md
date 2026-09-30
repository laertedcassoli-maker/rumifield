# Unificar "quem pode cancelar" na Corretiva

## Estado atual confirmado (lido agora)
- **Regras de edição no banco**: as 4 esperadas, sem drift.
  - "Admins and coordinators can update technical_tickets" e "...ticket_visits" usam `is_admin_or_coordinator` na leitura e na checagem.
  - "Assigned technicians can update their tickets" usa `auth.uid() = assigned_technician_id` e não tem checagem de gravação.
  - "Technicians can update their assigned visits" usa `auth.uid() = field_technician_user_id` e não tem checagem de gravação.
- **Permissões de `chamados_listagem`**: admin e coordenador_servicos já têm excluir = sim. A logística tem tudo = não e continua assim, por decisão sua. **Nenhum dado de permissão muda.**
- **DetalheChamado.tsx**:
  - O botão de cancelar/excluir usa `podeExcluirChamado`, que é uma regra fixa de papel.
  - O arquivo já tem `canDeleteTicket = canDelete('chamados_listagem')`, mas ele não é usado nesse botão.
- **ExecucaoVisitaCorretiva.tsx**:
  - `permissionContext` sempre fica em `'chamados'`. O único link que passa valor manda `'chamados'`, e nessa chave ninguém tem excluir = sim.
  - Por isso, hoje o botão de cancelar visita não aparece nem para o admin.
  - A mesma variável também controla "editar visita finalizada" (`canEditFinalized`) e a exclusão forçada de vinculados.

## Mudanças

### Banco (uma migração)
1. **Nova função** `can_cancel_corretiva(_user_id uuid)`:
   - SECURITY DEFINER, com `search_path=public`.
   - Libera se for admin, ou se o papel tiver `can_delete` em `chamados_listagem`.
   - Execução retirada de PUBLIC e anon, e dada só a authenticated e service_role.
2. **Regras de admin/coordenador**: as 2 passam a usar `can_cancel_corretiva(auth.uid())` na leitura e na checagem.
3. **Regras do técnico**: as 2 são recriadas com a mesma condição de hoje, e ganham uma checagem de gravação.
   - Chamados: mesma condição, e o status só pode ser `'cancelado'` se `can_cancel_corretiva`.
   - Visitas: mesma condição, e o status só pode ser `'cancelada'` se `can_cancel_corretiva`.

### Telas
- **DetalheChamado.tsx**: o botão passa a usar o `canDeleteTicket` que já existe. `podeExcluirChamado` é removido.
- **ExecucaoVisitaCorretiva.tsx**:
  - `canDeleteVisit` passa a ser `canDelete('chamados_listagem')` direto.
  - `permissionContext` continua existindo só para "editar finalizada", para não mudar quem edita visita concluída hoje.
- **Index.tsx**: nada muda, já estava certo.

## Pontos de atenção
- **Quem mais perde edição**: as regras de admin/coordenador cobrem toda edição, não só o cancelamento.
  - Hoje `is_admin_or_coordinator` inclui coordenador_rplus e coordenador_logistica.
  - Depois da troca, esses dois perdem **qualquer** edição de chamados e visitas que não sejam deles. O coordenador R+ tem editar = sim em chamados, então isso muda o que ele faz hoje.
  - Isso conflita com "nenhuma outra edição muda". Recomendo usar uma regra separada: manter a de admin/coordenador como está, e só impedir o cancelamento para quem não tem a permissão. Posso ajustar o plano se você preferir.
- **Aviso de segurança esperado**: a função gera o mesmo aviso de segurança padrão das anteriores. Ele é necessário para as regras funcionarem.

## Verificação
- Checagem de tipos limpa.
- Consulta confirmando as regras novas.
- Nada será publicado.
