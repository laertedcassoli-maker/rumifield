## Problema

A tela **Cadastro > Tags de Chamados** só permite que usuários com papel `admin` criem/editem/excluam tags. As políticas RLS atuais da tabela `ticket_tags` (e da tabela relacionada `ticket_tag_links`) restringem `INSERT/UPDATE/DELETE` exclusivamente a admins, então o Phelipe (coordenador de serviços) recebe erro ao salvar.

## Solução

Ampliar as políticas de gestão de tags para incluir também os papéis de coordenação, usando a função já existente `is_admin_or_coordinator(auth.uid())`, que cobre:
- admin
- coordenador_rplus
- coordenador_servicos
- coordenador_logistica

Nenhuma alteração de UI ou de lógica de aplicação é necessária — somente migração no banco.

## Migração proposta

```sql
-- ticket_tags
DROP POLICY IF EXISTS "Admins can manage ticket_tags" ON public.ticket_tags;

CREATE POLICY "Admins and coordinators can manage ticket_tags"
ON public.ticket_tags
FOR ALL
USING (public.is_admin_or_coordinator(auth.uid()))
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

-- ticket_tag_links (mesma lógica, pois TicketTags.tsx faz DELETE em links ao excluir tag)
-- Verificar/ajustar políticas equivalentes se existir restrição apenas para admin.
```

## Validação

Após aplicar:
1. Logar como Phelipe (coordenador de serviços).
2. Cadastro > Tags de Chamados → criar, editar, ativar/desativar e excluir uma tag.
3. Confirmar ausência de erro e persistência no banco.