# Tipo de solicitação fixo na criação quando a tela está filtrada

## Contexto
`/pedidos` tem `tipoSolicitacaoFilter` ('all' | 'envio' | 'coleta_reversa'), alimentado pelo submenu "Solicitação de Peças" e pelos botões de filtro. Hoje, "Novo pedido" sempre abre o formulário com o seletor de tipo escolhível, mesmo vindo de uma visão filtrada.

## Mudanças — apenas `src/pages/Pedidos.tsx`

### 1. Fixar o tipo ao abrir o dialog de criação (`handleCloseDialog`, ~linha 835)
`handleCloseDialog` também roda como `onOpenChange(isOpen=true)`. Adicionar no ramo de abertura:

```tsx
} else if (!editingPedido && tipoSolicitacaoFilter !== 'all') {
  setForm({ ...emptyForm, tipo_solicitacao: tipoSolicitacaoFilter });
}
```

O valor é definido apenas no momento em que o dialog abre (não reage a troca de filtro com o dialog aberto, conforme regra).

### 2. Substituir o toggle por rótulo fixo (~linhas 1513-1540)
Onde hoje está o `ToggleGroup` de "Tipo de Solicitação":

- Se `!editingPedido && tipoSolicitacaoFilter !== 'all'`: renderizar Label + `Badge` fixo (sem interação):
  - `envio` → Badge com `Truck` + "Envio"
  - `coleta_reversa` → Badge com `Package` + "Coleta Reversa"
- Caso contrário (`editingPedido` OU filtro 'all'): manter o `ToggleGroup` atual exatamente como está (com `disabled={!!editingPedido}`).

`Badge`, `Truck` e `Package` já estão importados.

## Não alterar
- Edição de pedido existente (toggle travado pelo tipo do pedido — intocado).
- Filtros da listagem, submenu do menu lateral, validações (motivo/relato, volumes, ativos, responsáveis).
- Tela de revisão, fluxo de rascunho/transmissão, coleta reversa automática.
- Nenhuma migration (não há mudança de schema).

## Validação
- Typecheck (`tsgo --noEmit -p tsconfig.app.json`) + build.
- Playwright: abrir `?tipo=envio` → Novo pedido mostra badge "Envio" sem toggle; `?tipo=coleta_reversa` → badge "Coleta Reversa"; sem filtro → toggle com as duas opções; editar pedido → toggle travado como hoje.
