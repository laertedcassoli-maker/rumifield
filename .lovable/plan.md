

## Corrigir check-in travado quando offline

### Causa raiz
O `checkinMutation` usa `navigator.onLine` para decidir entre Supabase e Dexie. Porém, `navigator.onLine` pode retornar `true` mesmo sem conectividade real (ex: modo avião recente, Wi-Fi sem internet). Quando isso acontece, a requisição ao Supabase fica pendurada indefinidamente — sem timeout — e o botão fica travado em "Salvando...".

O mesmo problema existe no `cancelMutation`.

### Solução
Envolver a chamada Supabase em um **timeout** (ex: 8 segundos). Se a requisição exceder o timeout, **fazer fallback automático para o caminho offline (Dexie)**, garantindo que o usuário nunca fique travado.

### Mudanças em `src/pages/preventivas/ExecucaoRota.tsx`

1. Criar helper `withTimeout` que rejeita uma Promise após N segundos
2. No `checkinMutation.mutationFn`:
   - Tentar o caminho online com timeout
   - No `catch`, se for erro de rede/timeout, executar o caminho offline (Dexie + sync queue) como fallback
3. Aplicar a mesma lógica no `cancelMutation.mutationFn`
4. Mostrar toast informando que os dados foram salvos localmente quando usar o fallback

```text
Fluxo atual:
  navigator.onLine? ──yes──> Supabase (pode travar)
                     ──no───> Dexie ✓

Fluxo corrigido:
  navigator.onLine? ──yes──> Supabase + timeout 8s
                              ──success──> ✓
                              ──timeout/err──> Dexie (fallback) ✓
                     ──no───> Dexie ✓
```

Extrair a lógica Dexie em funções reutilizáveis (`checkinOffline`, `cancelOffline`) para evitar duplicação entre o caminho `!navigator.onLine` e o catch de fallback.

### Arquivos
- `src/pages/preventivas/ExecucaoRota.tsx` — refatorar `checkinMutation` e `cancelMutation`

