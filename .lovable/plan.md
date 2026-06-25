# Plano: Responsáveis nas Ordens de Serviço

## 1. Banco de dados (migration)

- Adicionar coluna `concluded_by_user_id uuid` em `public.work_orders`, nullable, referenciando `auth.users(id)` (`ON DELETE SET NULL`).
- Sem alteração de RLS/GRANTs (a tabela já está configurada).

## 2. Preenchimento automático de `concluded_by_user_id`

No frontend, em todo ponto que atualiza `status` de uma OS para `concluido`, incluir também `concluded_by_user_id: user.id` (usuário autenticado). Quando o status voltar de `concluido` para outro, setar `concluded_by_user_id: null`.

Locais a ajustar:
- `src/components/oficina/DetalheOSDialog.tsx` — handlers que mudam status para `concluido` (botão de concluir / "Finalizar OS").
- Qualquer outro local que faça `update({ status: 'concluido' })` em `work_orders` (verificar via busca antes de editar).

## 3. UI — `src/pages/oficina/OrdensServico.tsx`

- Estender o fetch de perfis: além do `assigned_to_user_id`, buscar `nome` de `profiles` para `created_by_user_id` e `concluded_by_user_id` (um único `in('id', [...ids])` consolidando os três conjuntos), e mapear para `created_by_profile` e `concluded_by_profile` em cada OS.
- Atualizar a interface `WorkOrder` local com os dois novos campos opcionais `{ nome: string } | null`.
- Tabela desktop:
  - Aba "Abertas": nova coluna **Aberto por** (após "Responsável" ou em posição equivalente já usada para Responsável).
  - Aba "Concluídas": novas colunas **Aberto por** e **Concluído por**.
  - Renderizar `-` quando o nome estiver ausente.
- Cards mobile:
  - Linha "Aberto por: [nome]" abaixo do status.
  - Em OS concluídas, linha adicional "Concluído por: [nome]" (omitir se nulo).

## 4. UI — `src/components/oficina/DetalheOSDialog.tsx`

- Estender a interface `WorkOrder` com `created_by_profile` e `concluded_by_profile`.
- No painel de informações da OS, exibir:
  - **Aberto por:** sempre.
  - **Concluído por:** apenas quando `status === 'concluido'`.

## 5. UI — `src/components/oficina/OSKanban.tsx`

- Estender a interface `WorkOrder` com os dois campos de perfil.
- Em cada card: linha discreta `text-xs text-muted-foreground` com "Aberto por: [nome]".
- Nos cards da coluna "Concluído": linha adicional "Concluído por: [nome]" (omitir se nulo).

## Fora de escopo

- Filtros, ordenação, paginação, lógica de fetch existente para outras colunas — sem alterações.
- Sem mudanças em `WorkOrder` no servidor além da nova coluna.

## Detalhes técnicos

- Migration:
  ```sql
  ALTER TABLE public.work_orders
    ADD COLUMN concluded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  ```
- Atualização de status para concluído passa a enviar `{ status: 'concluido', concluded_by_user_id: user.id, end_time: <já existente> }`.
- Reversão de status (se houver fluxo) envia `{ concluded_by_user_id: null }`.
- Após a migration, `src/integrations/supabase/types.ts` é regenerado e as edições de código entram em seguida.
