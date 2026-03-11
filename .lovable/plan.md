

## Problema: Checklist não carrega offline após check-in

### Causa raiz

A página `AtendimentoPreventivo.tsx` depende de um `preventiveId` para renderizar o checklist. Quando **online**, se não existe um registro `preventive_maintenance`, a `queryFn` (linha 111) cria um via INSERT no banco. Quando **offline**, a `offlineFn` (linha 153) apenas busca no Dexie — se não encontra, retorna `preventiveId: null`.

O `checkinOffline` em `ExecucaoRota.tsx` salva apenas os dados do check-in no `rota_items` do Dexie. **Nunca cria o registro `preventive_maintenance` no Dexie.** Resultado: ao navegar para a tela de atendimento offline, `preventiveId` é `null` e aparece "Não foi possível criar o registro de manutenção".

### Correção (2 arquivos)

**1. `src/pages/preventivas/ExecucaoRota.tsx`** — No `checkinOffline`, após salvar o check-in, criar também um registro `preventive_maintenance` no Dexie (e na sync queue como INSERT):

```typescript
// Inside checkinOffline, after saving checkin data:
const item = await offlineDb.rota_items.get(itemId);
if (item) {
  const existingPm = await offlineDb.preventivas
    .filter(p => p.client_id === item.client_id && p.route_id === item.route_id)
    .first();
  
  if (!existingPm) {
    const pmId = crypto.randomUUID();
    await offlineDb.preventivas.put({
      id: pmId,
      client_id: item.client_id,
      route_id: item.route_id,
      scheduled_date: route?.start_date || new Date().toISOString().split('T')[0],
      status: 'planejada',
      technician_user_id: route?.field_technician_user_id || user?.id || null,
      notes: `Atendimento via rota ${route?.route_code}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await offlineDb.addToSyncQueue('preventive_maintenance', 'insert', {
      id: pmId,
      client_id: item.client_id,
      route_id: item.route_id,
      scheduled_date: route?.start_date,
      status: 'planejada',
      technician_user_id: route?.field_technician_user_id || user?.id,
      notes: `Atendimento via rota ${route?.route_code}`,
    });
  }
}
```

**2. `src/pages/preventivas/AtendimentoPreventivo.tsx`** — Na `offlineFn`, se não encontrar preventive no Dexie, criar um localmente (mesma lógica de fallback):

```typescript
// In offlineFn, after checking allPreventivas:
let preventiveRecord = allPreventivas;
if (!preventiveRecord && route) {
  const pmId = crypto.randomUUID();
  const newPm = {
    id: pmId,
    client_id: item.client_id,
    route_id: item.route_id,
    scheduled_date: route.start_date || new Date().toISOString().split('T')[0],
    status: 'planejada',
    technician_user_id: route.field_technician_user_id,
    notes: `Atendimento via rota ${route.route_code}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await offlineDb.preventivas.put(newPm);
  await offlineDb.addToSyncQueue('preventive_maintenance', 'insert', { ... });
  preventiveRecord = newPm;
}
```

### O que isso resolve

- Check-in offline agora cria o registro preventive_maintenance no Dexie
- A tela de atendimento encontra o `preventiveId` e renderiza o checklist
- Quando voltar online, a sync queue cria o registro no banco (com tratamento de duplicata 23505)
- Dupla proteção: tanto no check-in quanto na abertura da tela de atendimento

