

## Tornar o sync de rotas mais robusto

### Alteração única: `src/hooks/useOfflineSync.ts` (linhas 261-296)

**Antes:** o bloco inteiro (enriquecer + salvar) só executa dentro de `if (result.data?.length)`. Se a API retorna `[]` ou falha parcial, nada acontece e dados locais existentes ficam órfãos ou a tabela permanece vazia de syncs anteriores que fizeram `clear()`.

**Depois:**
- Se `result.data` tem dados → `bulkPut` direto (upsert), **sem `clear()`** antes. Dados locais de rotas que não vieram na resposta são preservados.
- Se `result.data` está vazio → não faz nada (preserva cache existente).

```typescript
// Substituir linhas 261-296 por:
if (result.data && result.data.length > 0) {
  const routeIds = result.data.map(r => r.id);
  const techIds = [...new Set(result.data.map(r => r.field_technician_user_id).filter(Boolean))] as string[];

  const [itemsRes, profilesRes] = await Promise.all([
    supabase.from("preventive_route_items").select("route_id, status").in("route_id", routeIds),
    techIds.length > 0 ? supabase.from("profiles").select("id, nome").in("id", techIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] })
  ]);

  // ... (mesmo enriquecimento existente, sem alteração)

  // MUDANÇA: bulkPut sem clear() — upsert preserva dados existentes
  await offlineDb.rotas.bulkPut(enriched as any);
}
// Se result.data vazio → preserva cache local (não faz clear)
```

Remoção da linha `await offlineDb.rotas.clear();` (linha 294) — essa é a única mudança efetiva no código.

