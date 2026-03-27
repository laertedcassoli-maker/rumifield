

## Correção de 3 bugs no módulo de visitas corretivas (mobile)

A análise está correta. Os 3 bugs são reais e as correções propostas são adequadas. Segue o plano validado:

### FIX 1 — NovaVisitaDiretaDialog.tsx: nova visita aparece na lista

**Arquivo:** `src/components/chamados/NovaVisitaDiretaDialog.tsx`

No `onSuccess` (linha ~139), trocar `invalidateQueries` por `refetchQueries` com await:

```ts
onSuccess: async (data) => {
  await queryClient.refetchQueries({ queryKey: ['my-corrective-visits'] });
  queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });
  toast({ title: `Nova Visita agendada: ${data.ticketCode}` });
  handleClose();
},
```

Isso força aguardar o refetch da rede antes de fechar o dialog, garantindo que a lista exiba a visita recém-criada.

### FIX 2 — ExecucaoVisitaCorretiva.tsx: check-in otimista

**Arquivo:** `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

No `checkinMutation.onSuccess` (linhas 248-254), adicionar `setQueryData` otimista antes do `invalidateQueries`:

```ts
onSuccess: () => {
  queryClient.setQueryData(
    ['corrective-visit-execution', visitId],
    (old: any) => {
      if (!old) return old;
      return { ...old, checkin_at: new Date().toISOString(), status: 'em_execucao' };
    }
  );
  queryClient.invalidateQueries({ queryKey: ['corrective-visit-execution', visitId] });
  queryClient.invalidateQueries({ queryKey: ['my-corrective-visits'] });
  toast({ title: 'Check-in realizado!', description: 'Você pode iniciar o atendimento.' });
  setIsCheckingIn(false);
},
```

A tela transiciona imediatamente para o estado pós-checkin sem aguardar refetch.

### FIX 3 — useGeolocation.ts: GPS rápido

**Arquivo:** `src/hooks/useGeolocation.ts`

Alterar as options do `getCurrentPosition` (linha ~53):

```ts
{
  enableHighAccuracy: false,  // triangulação celular/WiFi, 1-2s em vez de 10-30s
  timeout: 8000,              // falha em 8s no máximo
  maximumAge: 120000,         // aceita coordenada de até 2 min (suficiente para check-in em fazenda)
}
```

### Resumo de impacto

- 3 arquivos alterados, apenas nos pontos indicados
- Nenhuma mudança de layout, estilo ou lógica de negócio
- Melhora significativa da experiência mobile em campo com rede instável

