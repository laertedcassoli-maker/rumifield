

## Diagnóstico

O problema é de **timing**: `hasFailureDetails` (linha 1176) exige que `availableNonconformities.length > 0`, mas essa lista vem de `templateNonconformities` que é carregada por uma query separada (com fallback assíncrono ao Dexie). Se o template data ainda não carregou quando o usuário clica FALHA, `availableNonconformities` é `[]` → `hasFailureDetails = false` → collapsible não renderiza.

Isso é uma condição de corrida que depende da velocidade de leitura do Dexie vs interação do usuário. O motivo de ter "voltado" é que as mudanças anteriores podem ter alterado levemente o timing de renders.

## Correção

**Arquivo:** `src/components/preventivas/ChecklistExecution.tsx`

**1. Desvincular visibilidade do collapsible do carregamento de template data**

Alterar `hasFailureDetails` para depender apenas do status:
```ts
const hasFailureDetails = item.status === 'N';
```

**2. Dentro do collapsible, tratar dados de template ainda não carregados**

Se `availableNonconformities` e `availableActions` estiverem ambos vazios E o status é 'N', mostrar um spinner/loading ao invés de nada:
```tsx
{item.availableNonconformities.length === 0 && item.availableActions.length === 0 && (
  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    Carregando tratativas...
  </div>
)}
```

**3. Ajustar `needsTreatment` e `missingNonconformity`/`missingAction`**

Esses cálculos já verificam `availableNonconformities.length > 0` antes de exigir seleções, então continuam funcionando corretamente — só alertam quando há opções disponíveis mas nenhuma selecionada.

**4. Ajustar `hasIncompleteFailures` (linha 986-995)**

O cálculo global já verifica `availableNonconformities.length > 0`, então não bloqueia indevidamente. Sem mudança necessária.

### Resultado
- Clicar FALHA → collapsible aparece imediatamente (não depende de template data)
- Se template data ainda carrega → mostra "Carregando tratativas..."
- Quando template data chega → lista de NCs e ações aparece normalmente
- Zero risco de regressão nos cálculos de validação

