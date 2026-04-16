
Adicionar ação de exclusão na tabela de tags cadastradas em `src/pages/admin/TicketTags.tsx`.

## Plano

### `src/pages/admin/TicketTags.tsx`
- Adicionar `deleteMutation` que:
  1. Remove vínculos em `ticket_tag_assignments` (caso existam) para evitar FK violations.
  2. Deleta a tag em `ticket_tags` por `id`.
  3. Captura erros explicitamente (`if (error) throw error`).
  4. `onSuccess`: invalida `['ticket-tags-admin']` + toast "Tag excluída!".
  5. `onError`: toast destrutivo.
- Adicionar botão "Excluir" (ícone `Trash2`, variant ghost, cor destructive) na coluna Ações, ao lado do botão de editar.
- Envolver o botão em `AlertDialog` (já disponível em `@/components/ui/alert-dialog`) com confirmação destrutiva: título "Excluir tag?", descrição alertando que a tag será removida de todos os chamados, botões "Cancelar" / "Excluir".
- Ajustar largura da coluna Ações para `w-[120px]` para acomodar os dois botões.

### Detalhes técnicos
- Verificar se existe tabela de vínculo (provavelmente `ticket_tag_assignments` ou similar) antes de implementar — se não existir, deletar direto. Confirmar via `supabase--read_query` antes de codar.
- Manter padrão do projeto: confirmação explícita destrutiva (alinhado a `mem://features/consumed-parts-deletion-logic`).
- Sem mudanças de schema, RLS ou layout além do botão extra.

### Fora do escopo
- Soft-delete (usar `is_active=false` já existe via Switch).
- Reordenação de tags.
