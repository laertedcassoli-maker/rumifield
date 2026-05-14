## Objetivo
Exibir o **Modelo de Solenoide (2x/3x)** na tela de **Detalhes do Pedido**, hoje apenas salvo no banco mas invisível na visualização.

## Alteração

### `src/pages/Pedidos.tsx` — bloco de visualização (`viewingPedido`, ~linhas 1717-1734)
Adicionar, logo após o card de Cliente (e ao lado/abaixo da data de criação), uma linha/badge condicional:

- Se `viewingPedido.solenoide_modelo` estiver preenchido (`'2x'` ou `'3x'`), renderizar um bloco rotulado **"Modelo do Solenoide"** mostrando o valor em destaque (ex.: badge `2x` ou `3x`).
- Caso contrário, não renderiza nada (mantém compatibilidade com pedidos antigos sem PRD00605).

Exemplo de marcação a inserir:
```tsx
{viewingPedido.solenoide_modelo && (
  <div className="p-3 rounded-lg bg-muted/50 border flex items-center justify-between">
    <span className="text-sm text-muted-foreground">Modelo do Solenoide</span>
    <Badge variant="secondary" className="font-mono">
      {viewingPedido.solenoide_modelo}
    </Badge>
  </div>
)}
```

Nenhuma outra mudança é necessária:
- A coluna já é persistida no `INSERT`/`UPDATE` do rascunho.
- A query de listagem (`select('*')` em `pedidos`) já traz o campo, então `viewingPedido.solenoide_modelo` está disponível.
- Tipagem (`src/integrations/supabase/types.ts`) já contém `solenoide_modelo`.

## Resultado
Ao abrir **Pedidos > Detalhes do pedido**, quando houver PRD00605 no pedido, o modelo escolhido (2x ou 3x) aparece logo abaixo das informações do cliente.
