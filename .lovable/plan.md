

## Diagnóstico: Timer não ativa para um usuário específico

### Causa raiz provável

O problema está na query que busca o timer ativo (linha 150-166 de `DetalheOSDialog.tsx`):

```typescript
.from('work_order_time_entries')
.select('*')
.eq('work_order_id', workOrder.id)
.eq('user_id', user.id)
.eq('status', 'running')
.maybeSingle();  // ← PROBLEMA AQUI
```

**`maybeSingle()` retorna ERRO se encontrar MAIS DE UMA linha.** Se esse usuário acumulou múltiplas entradas "running" (por retries de rede, bugs anteriores, cliques duplos, etc.), a query falha silenciosamente e retorna `null`. O fluxo fica:

1. Usuário clica Play → optimistic timer aparece → insert no banco funciona → toast de sucesso ✓
2. `onSettled` limpa o optimistic entry
3. Query `active-time-entry` refaz fetch → encontra 2+ entries "running" → `maybeSingle()` falha → retorna `null`
4. Timer desaparece da tela

Isso explica por que afeta **apenas um usuário** — é quem tem entries "running" duplicadas no banco.

### Plano de correção

**1. Corrigir a query do timer ativo** — usar `.order().limit(1)` para sempre retornar a entrada mais recente, mesmo havendo duplicatas:

```typescript
.eq('status', 'running')
.order('started_at', { ascending: false })
.limit(1)
.maybeSingle();
```

**2. Verificar e limpar dados do banco** — consultar se há entries "running" duplicadas para identificar o usuário afetado e fechar as entradas órfãs.

**3. Adicionar proteção contra duplicatas no start** — após o insert, usar `maybeSingle` com order para garantir consistência, ou adicionar uma constraint unique no banco para `(user_id, status)` onde `status = 'running'`.

