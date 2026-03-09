

## Diagnóstico

Verifiquei no banco de dados e o código do motor **DD-54321** está corretamente salvo no workshop_item da OS-2026-00021. O horímetro também está correto (200h).

O problema é de **invalidação de cache**: quando a OS é concluída, o `completeOSMutation` invalida a query `['workshop-items']`, mas a MotorSection usa uma query diferente: `['workshop-item-motor', workshopItemId]`. Essa query nunca é invalidada, então o componente continua exibindo dados antigos (de antes da conclusão, quando o motor ainda não tinha código).

## Correção

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

Adicionar invalidação da query do MotorSection no `onSuccess` da mutation de conclusão:

```typescript
// Linha ~779, dentro do onSuccess do completeOSMutation
queryClient.invalidateQueries({ queryKey: ['workshop-item-motor'] });
queryClient.invalidateQueries({ queryKey: ['motor-history'] });
```

Isso garante que ao reabrir a OS concluída, o MotorSection busque dados atualizados do banco.

**Nota:** um refresh da página (F5) deve resolver o problema imediatamente para a OS-2026-00021, pois o dado já está correto no banco.

