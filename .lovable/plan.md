
## Corrigir Popover deslocado no mobile

### Problema
O `PopoverContent` esta configurado com `side="left"` e largura fixa de `w-80` (320px). No mobile, onde os cards ocupam a tela toda (`grid-cols-1`), o popover abre para a esquerda do botao e ultrapassa os limites da tela.

### Solucao
Alterar o posicionamento do popover para funcionar melhor em todas as telas:

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

1. Trocar `side="left"` para `side="bottom"` -- o popover abrira abaixo do botao, que funciona bem tanto em mobile quanto desktop
2. Manter `align="end"` para alinhar a borda direita do popover com o botao
3. Adicionar `collisionPadding={16}` para garantir que o Radix Popover respeite uma margem de 16px das bordas da tela (evita corte em qualquer direcao)
4. Ajustar a largura para `w-[min(320px,calc(100vw-32px))]` para que nunca ultrapasse a tela no mobile

### Alteracao especifica (linha 162-165)
```tsx
<PopoverContent
  className="w-[min(320px,calc(100vw-32px))] max-h-96 overflow-y-auto p-3"
  align="end"
  side="bottom"
  collisionPadding={16}
  onClick={(e) => e.stopPropagation()}
>
```

### Resultado
- Mobile: popover abre abaixo do botao, respeitando os limites da tela
- Desktop: mesmo comportamento, popover alinhado ao botao sem corte
