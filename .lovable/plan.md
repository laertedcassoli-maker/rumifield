

## Corrigir check-in travado offline (iPhone)

### Problema
No iPhone em modo avião, `navigator.onLine` retorna `true`. O código tenta o Supabase, que falha com um erro que **não** é reconhecido por `isNetworkError` (provavelmente um `PostgrestError` ou erro de fetch com mensagem diferente no Safari/iOS). O `catch` faz `throw err` em vez de fallback, e o `onError` mostra erro mas o dialog já travou.

### Solução
Duas mudanças em `ExecucaoRota.tsx`:

1. **No `catch` de ambas mutations**: remover a checagem `isNetworkError` e fazer fallback offline para **qualquer** erro. Se estávamos tentando online e falhou, salvar localmente é sempre seguro.

2. **Manter `navigator.onLine`** no check inicial (para ir direto ao Dexie quando possível), mas o catch garante que qualquer falha resulta em fallback.

```typescript
// checkinMutation catch (linha ~260):
} catch (err) {
  // Qualquer falha online → fallback offline
  await checkinOffline(itemId, lat, lon, now);
  toast({ title: 'Salvo localmente', description: '...' });
  return;
}

// cancelMutation catch (linha ~367):
} catch (err) {
  await cancelOffline(itemId, clientId, justification);
  toast({ title: 'Salvo localmente', description: '...' });
  return;
}
```

### Arquivo
- `src/pages/preventivas/ExecucaoRota.tsx` — simplificar catch blocks

