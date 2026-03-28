

## Correção: checklist some + peças automáticas não aparecem (WiFi estável)

### Bug 1 — Peças automáticas não aparecem

**Causa raiz:** `ConsumedPartsBlock.tsx` linha 104 — query tem `enabled: !!preventiveId && isOnline`. Mesmo online, o `refetchQueries` chamado pelo `ChecklistExecution` pode não surtar efeito se a query ficou brevemente desabilitada durante um ciclo de render. Além disso, a lógica de merge com Dexie (linhas 108-137) adiciona complexidade sem benefício para peças auto-criadas (que nunca são escritas no Dexie).

**Correção — Arquivo:** `src/components/preventivas/ConsumedPartsBlock.tsx`

Linha 104: remover `isOnline` do `enabled`:
```ts
// DE:
enabled: !!preventiveId && isOnline,
// PARA:
enabled: !!preventiveId,
```

Isso garante que a query esteja sempre ativa e responda ao `refetchQueries`.

### Bug 2 — Checklist some ao voltar e clicar "Continuar"

**Causa raiz:** `AtendimentoPreventivo.tsx` linhas 93-98 — o queryFn descarta erros silenciosamente:
```ts
const { data: existingPm } = await supabase...  // error ignorado!
```
Se a chamada falha, `preventiveId` fica `null`, a UI mostra o dead-end, e o `retry: 3` nunca dispara porque a função retorna sem lançar exceção.

**Correção — Arquivo:** `src/pages/preventivas/AtendimentoPreventivo.tsx`

Adicionar throw em 3 pontos da queryFn:

1. Linha 65-71 (route_items): já lança ✅
2. Linhas 75-79 (route): adicionar tratamento de erro:
```ts
const { data: route, error: routeError } = await supabase...
if (routeError) throw routeError;
```
3. Linhas 82-86 (client): idem:
```ts
const { data: client, error: clientError } = await supabase...
if (clientError) throw clientError;
```
4. Linhas 93-98 (preventive_maintenance): idem:
```ts
const { data: existingPm, error: pmError } = await supabase...
if (pmError) throw pmError;
```

### Resumo
- 2 arquivos, alterações cirúrgicas
- Nenhuma mudança de layout, lógica de negócio ou estilos
- Bug 1: query de peças sempre habilitada → refetch funciona
- Bug 2: erros propagados → retry automático funciona

