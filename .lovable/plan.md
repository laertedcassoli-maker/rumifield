

## Correção: Ocultar "Tipo de Logística" quando tipo de envio for "Apenas NF"

### Problema
Os diálogos de "Processar" e "Concluir" sempre exibem e exigem o campo "Tipo de Logística", mesmo quando o pedido tem `tipo_envio = 'apenas_nf'`. Nesse caso, não há envio físico, então logística não se aplica.

### Solução
Condicionar a exibição do campo de logística ao `tipo_envio` do pedido:
- Se `tipo_envio === 'apenas_nf'`: ocultar o campo de logística e não exigir preenchimento
- Se `tipo_envio === 'envio_fisico'` ou não definido: manter comportamento atual

### Alterações

**1. `ProcessarPedidoDialog.tsx`**
- Verificar `pedido?.tipo_envio` -- se for `apenas_nf`, não renderizar a seção de logística

**2. `ConcluirPedidoDialog.tsx`**
- Verificar `pedido?.tipo_envio` -- se for `apenas_nf`:
  - Ocultar o campo de logística
  - Remover a validação obrigatória de `tipoLogistica` no botão "Confirmar"
  - Passar string vazia ou `'nao_aplicavel'` como tipo de logística ao confirmar

**3. `PedidoKanban.tsx`**
- Passar o `pedido` completo (já é passado) para os diálogos, garantindo que `tipo_envio` esteja acessível

### Detalhes Técnicos

No `ConcluirPedidoDialog`, a validação do botão muda de:
```
disabled={!nfNumero.trim() || !tipoLogistica || isSubmitting}
```
Para:
```
disabled={!nfNumero.trim() || (needsLogistica && !tipoLogistica) || isSubmitting}
```

Onde `needsLogistica = pedido?.tipo_envio !== 'apenas_nf'`.

Na chamada de `onConfirm`, quando logística não se aplica, enviar `'nao_aplicavel'` para manter o campo preenchido no banco.

