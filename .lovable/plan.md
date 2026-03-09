

## Corrigir check-in travado offline no iPhone

### Problema
O código na linha 234 usa `navigator.onLine` para decidir o caminho offline. No iPhone em modo avião, `navigator.onLine` retorna `true`, então o código tenta o Supabase. Embora exista um timeout de 8s e catch com fallback, o `fetch()` do Safari pode se comportar de forma inesperada — possivelmente ignorando o `setTimeout` ou travando antes do timeout disparar.

O componente já tem `isOffline` (linha 206) que **funciona corretamente** — o banner "Você está offline" aparece. Mas as mutations não usam essa variável.

### Solução
Substituir `navigator.onLine` por `isOffline` nas duas mutations (checkin e cancel). Quando `isOffline` é `true`, ir direto para Dexie sem nem tentar o Supabase. Isso elimina completamente o problema do timeout/fetch no Safari.

### Mudanças em `src/pages/preventivas/ExecucaoRota.tsx`

1. **checkinMutation (linha 234)**: trocar `if (!navigator.onLine)` por `if (isOffline)`
2. **cancelMutation (mesma lógica)**: trocar `if (!navigator.onLine)` por `if (isOffline)`

Mudança mínima — apenas duas linhas.

