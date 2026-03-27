

## Correção de 2 bugs em Visitas Corretivas (mobile)

### BUG A — Nova visita não aparece na lista sem Force Sync

**Arquivo:** `src/components/chamados/NovaVisitaDiretaDialog.tsx`

**Causa:** A lista usa `useLiveQuery` do Dexie. O `refetchQueries` no `onSuccess` não tem efeito pois não há `useQuery` ativo com essa chave.

**Correção (2 pontos no mesmo arquivo):**

1. **Linha 141** — alterar o insert de `ticket_visits` para retornar os dados com `.select('id, visit_code').single()`:
```ts
const { data: visitData, error: visitError } = await supabase
  .from('ticket_visits')
  .insert({ ... })
  .select('id, visit_code')
  .single();
```

2. **Após o insert ter sucesso (antes do return)** — escrever no Dexie:
```ts
await offlineDb.corretivas.put({
  id: visitData.id,
  visit_code: visitData.visit_code,
  ticket_id: ticket.id,
  ticket_code: ticketCode,
  ticket_title: title,
  client_id: clientId,
  client_name: selectedClient?.nome || '',
  client_fazenda: selectedClient?.fazenda || null,
  field_technician_user_id: user!.id,
  status: 'em_elaboracao',
  planned_start_date: plannedDate ? format(plannedDate, 'yyyy-MM-dd') : null,
  checkin_at: null, checkin_lat: null, checkin_lon: null, checkout_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
```

3. **`onSuccess`** — manter o `refetchQueries` (inofensivo) ou removê-lo. A lista já atualizará via `useLiveQuery`.

Adicionar import de `offlineDb` no topo do arquivo.

---

### BUG B — Botão "Fazer Check-in" reaparece após clique

**Arquivo:** `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

**Causa:** `invalidateQueries` dispara refetch imediato que pode retornar `checkin_at: null` (replica lag), sobrescrevendo o `setQueryData` otimista.

**Correção (linhas 256-257)** — adicionar `refetchType: 'none'`:
```ts
queryClient.invalidateQueries({
  queryKey: ['corrective-visit-execution', visitId],
  refetchType: 'none',
});
queryClient.invalidateQueries({
  queryKey: ['my-corrective-visits'],
  refetchType: 'none',
});
```

---

### Resumo
- 2 arquivos alterados, pontos cirúrgicos
- Nenhuma mudança de layout, estilo ou lógica de negócio

