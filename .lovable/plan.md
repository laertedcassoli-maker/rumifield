# Cancelamento de Ordens de Serviço (com permissão controlada pela tela de Permissões)

## Estado atual confirmado no banco
- Exclusão de OS: "Admins can delete work_orders" = `is_admin_or_coordinator(auth.uid()) AND status='aguardando'`.
- Edição de OS: "Users can update assigned work_orders" = `assigned_to_user_id OR created_by_user_id OR is_admin_or_coordinator() OR tecnico_oficina`, sem WITH CHECK.
- Permissão "Excluir" em `oficina_os` hoje: admin = sim, coordenador_servicos = sim, coordenador_logistica = **não** (passa a sim). Demais papéis continuam não.
- A OS tem a coluna `notes` (onde o motivo será anexado).

## O que muda para o usuário
- OS "Aguardando": o botão de excluir continua excluindo de verdade.
- OS em outro status: o mesmo botão abre "Cancelar Ordem de Serviço" com "Motivo do cancelamento *" obrigatório; a OS fica "Cancelada" e o motivo vai para as observações com data/hora (sem apagar o que já havia).
- Só admin, coordenador de serviços e coordenador de logística conseguem cancelar/excluir; o banco recusa para os demais, mesmo pela API.
- Técnico designado continua editando normalmente, mas não consegue marcar a OS como cancelada.
- Remover peça usada só aparece com a OS "Aguardando".
- OS cancelada some de "Abertas" e não conta como ativa; ganha selo "Cancelada".

## Detalhes técnicos
1. **Migração**
   - `can_cancel_work_order(_user_id uuid) returns boolean` SECURITY DEFINER, `search_path=public`: `has_role(_user_id,'admin') OR EXISTS (user_roles ur JOIN role_menu_permissions rmp ON rmp.role = ur.role WHERE ur.user_id=_user_id AND rmp.menu_key='oficina_os' AND rmp.can_delete)`.
   - Recriar "Admins can delete work_orders": `can_cancel_work_order(auth.uid()) AND status='aguardando'`.
   - Recriar "Users can update assigned work_orders" com o mesmo USING e `WITH CHECK (<mesmo USING> AND (status IS DISTINCT FROM 'cancelada' OR can_cancel_work_order(auth.uid())))`.
2. **Dados**: upsert `can_delete=true` em `oficina_os` para admin, coordenador_servicos, coordenador_logistica (só a logística muda de fato).
3. **`DetalheOSDialog.tsx`**: tipo de status ganha `'cancelada'`; `deleteWorkOrderMutation` decide excluir (aguardando) ou cancelar (update `status='cancelada'`, `notes` + `[Cancelada em dd/mm/aaaa hh:mm] motivo`, `.select('id')`, timeout 12s); diálogo condicional reaproveitando `CancelReasonDialog`; botão escondido se já cancelada; remover peça (~l.1805) passa a exigir `status === 'aguardando'`; selo "Cancelada"; OS cancelada fica somente leitura (mesmos pontos que hoje checam `'concluido'`).
4. **`OrdensServico.tsx`**: mesma lógica em `deleteOSMutation`/`deleteTarget`; "Abertas" exclui `cancelada`; labels/cores ganham "Cancelada".
5. `GestaoOS.tsx` e `useMinhasPendencias.ts` já usam listas explícitas de status — sem mudança.
6. Sem publicar. Typecheck ao final.
