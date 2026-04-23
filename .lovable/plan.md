

## Diagnóstico: política RLS bloqueia a própria conclusão do checklist

### O erro

Quando o técnico clica em **"Finalizar Checklist"**, o código faz:

```ts
// src/components/preventivas/ChecklistExecution.tsx (linha 986-992)
supabase.from('preventive_checklists')
  .update({ status: 'concluido', completed_at: ... })
  .eq('id', existingChecklist.id);
```

A tabela `preventive_checklists` tem a política:

| policyname | cmd | USING | WITH CHECK |
|---|---|---|---|
| Technicians can update own preventive_checklists | UPDATE | `status = 'em_andamento'` | *(nulo → herda USING)* |

Quando `WITH CHECK` é nulo num UPDATE, o Postgres aplica a expressão do `USING` também na **nova linha**. Como o técnico está mudando `status` de `em_andamento` para `concluido`, a nova linha falha em `status = 'em_andamento'` e dispara o erro:

> *"nova linha viola política de segurança"*.

Ou seja, a política impede exatamente a transição que deveria liberar. Admin/coordenador passam por uma policy separada (`is_admin_or_coordinator`), por isso eles conseguem.

### Plano de correção (uma migration SQL)

Recriar a policy de UPDATE com `WITH CHECK` explícito que:
1. Permite atualizar enquanto o checklist está `em_andamento` (evita mexer em checklists já concluídos por outras pessoas).
2. Aceita a nova linha desde que o técnico seja o dono da rota — independentemente do novo status (`em_andamento` ou `concluido`).

```sql
-- Substitui a policy quebrada
DROP POLICY IF EXISTS "Technicians can update own preventive_checklists"
  ON public.preventive_checklists;

CREATE POLICY "Technicians can update own preventive_checklists"
ON public.preventive_checklists
FOR UPDATE
TO authenticated
USING (
  status = 'em_andamento'
  AND EXISTS (
    SELECT 1
    FROM public.preventive_maintenance pm
    JOIN public.preventive_route_items pri ON pri.id = pm.route_item_id
    JOIN public.preventive_routes pr ON pr.id = pri.route_id
    WHERE pm.id = preventive_checklists.preventive_id
      AND pr.field_technician_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.preventive_maintenance pm
    JOIN public.preventive_route_items pri ON pri.id = pm.route_item_id
    JOIN public.preventive_routes pr ON pr.id = pri.route_id
    WHERE pm.id = preventive_checklists.preventive_id
      AND pr.field_technician_user_id = auth.uid()
  )
);
```

> Observação: o nome exato da coluna que liga `preventive_maintenance` ao `route_item` precisa ser confirmado no momento da migration (pode ser `route_item_id` ou outro). Vou validar contra o schema antes de aplicar e ajustar o JOIN se necessário (mantendo a mesma intenção: técnico dono da rota = autorizado).

### Onde NÃO mexer

- **Código React**: `ChecklistExecution.tsx` está correto, não precisa de mudança.
- **Outras policies** (`INSERT`, `SELECT`, `ALL` para admin): permanecem intactas.
- **Sem alteração de RLS** em `preventive_checklist_items`, `preventive_route_items`, `preventive_maintenance`, `preventive_routes` — essas já foram corrigidas em migrations anteriores e estão funcionando (Roger consegue responder itens, fazer check-in e encerrar visita pelo fluxo normal).

### Prompt para o Lovable

> **Bug fix — Técnico não consegue finalizar checklist preventivo (RLS bloqueia transição de status)**
>
> **Sintoma**: Ao clicar em "Finalizar Checklist", aparece *"Erro ao concluir: nova linha viola política de segurança para a tabela preventive_checklists"*. Admin/coordenador conseguem; técnico de campo não.
>
> **Causa raiz**: A policy `Technicians can update own preventive_checklists` em `public.preventive_checklists` tem `USING (status = 'em_andamento')` e `WITH CHECK` nulo. Como `WITH CHECK` nulo herda o `USING`, a nova linha (com `status = 'concluido'`) falha a checagem e o UPDATE é bloqueado — exatamente a transição que deveria ser permitida.
>
> **Fix**: Criar nova migration que faz `DROP POLICY` da política atual e recria com `USING` validando que (a) o checklist ainda está `em_andamento` e (b) o usuário autenticado é o `field_technician_user_id` da rota dona do checklist (via JOIN `preventive_maintenance` → `preventive_route_items` → `preventive_routes`); e `WITH CHECK` validando apenas (b), permitindo qualquer status novo (`em_andamento` ou `concluido`).
>
> **Não alterar**: código React, demais policies da tabela, nem RLS de outras tabelas (já corrigidas anteriormente).
>
> **Validação pós-deploy**: pedir ao Roger para abrir o checklist da fazenda travada, responder o último item se faltar, e clicar em "Finalizar Checklist" — deve concluir sem erro e liberar o botão "Encerrar Visita".

