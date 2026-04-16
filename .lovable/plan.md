
## Diagnóstico atualizado

Confirmado via DB:
- **Ivan Henrique** é `coordenador_logistica` (criou e está como `assigned_to_user_id`).
- A função `is_admin_or_coordinator` **já inclui** `coordenador_logistica` → RLS NÃO bloqueia o update.
- `work_order_items` foi salvo com `meter_hours_exit=182.7` ✅, mas `workshop_items.meter_hours_last=NULL` e `status='em_manutencao'` (com `updated_at` igual ao `created_at`, ou seja, **o UPDATE nunca chegou a rodar**).

Conclusão: não foi RLS nem o trigger `validate_meter_hours` (NULL→valor é permitido). O update do `workshop_items` simplesmente **não foi executado**, mesmo o de `work_order_items` tendo rodado logo antes. Provável causa: condição `if (univocaItem.workshop_item_id)` foi falsa porque o estado local (`workOrderItems` do `useQuery`) estava desatualizado/sem o `workshop_item_id` populado no momento do clique. Sem `.select()`, qualquer 0-row update passa despercebido.

Independente da causa exata (que pode ter sido race de cache local), o problema estrutural é o mesmo: **3 updates em `workshop_items` sem detecção de 0-row**, violando `mem://security/rls-silent-failure-detection`.

## Plano

### 1. Corrigir registro órfão (insert tool / UPDATE)
Atualizar diretamente o ativo `0000071`:
- `status = 'disponivel'`
- `meter_hours_last = 182.7`

### 2. Blindar `completeOSMutation` em `src/components/oficina/DetalheOSDialog.tsx`
Nos 3 updates de `workshop_items` (linhas 807, 821, 842):
- Adicionar `.select('id')` ao final.
- Após cada update: `if (!data || data.length === 0) throw new Error('Falha ao atualizar status do ativo — recarregue a tela e tente novamente')`.

### 3. Garantir que `univocaItem` está fresco antes do complete
Antes de executar o bloco da linha 682, refazer um SELECT direto em `work_order_items` por `work_order_id` para evitar trabalhar com cache local desatualizado. Usar esse resultado fresh em vez de `workOrderItems` (state).

### Fora do escopo
- Refatorar permissões da oficina.
- Backfill de outras OS antigas (tratar caso a caso se aparecerem).
