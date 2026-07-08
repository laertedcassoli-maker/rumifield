
## Problema

Em `TicketPartsRequestPanel.tsx` e `Pedidos.tsx`, quando o usuário remove manualmente a peça auto-vinculada (PRD00639), ela reaparece se ele adicionar outra peça ou alterar quantidade, porque `applyAutoLinks()` é reavaliada em toda mutação e reinsere o alvo enquanto o gatilho (PRD00605) ainda estiver presente.

A correção pontual em `removePart`/`removeItem` (não chamar `applyAutoLinks` após remoção manual) não basta: `addPart`, `updateQuantity`, `updateItem`, `incrementQuantity` e `decrementQuantity` continuam reintroduzindo o alvo.

## Solução

Adicionar um flag de estado `autoLinkDismissed` que "lembra" a remoção manual do alvo até que o gatilho seja removido (o que reseta o flag). Enquanto `autoLinkDismissed === true`, `applyAutoLinks` retorna a lista intacta.

## Arquivos alterados

Apenas dois:

- `src/components/chamados/TicketPartsRequestPanel.tsx`
- `src/pages/Pedidos.tsx`

Nenhum outro arquivo é tocado.

### 1. `src/components/chamados/TicketPartsRequestPanel.tsx`

- Novo estado: `const [autoLinkDismissed, setAutoLinkDismissed] = useState(false);`
- `applyAutoLinks(list)`: no início, `if (autoLinkDismissed) return list;`.
- `removePart(pecaId)`:
  - se `targetPart && pecaId === targetPart.id` → `setAutoLinkDismissed(true)`
  - se `triggerPart && pecaId === triggerPart.id` → `setAutoLinkDismissed(false)` (além do reset atual de `solenoideModelo`)
- `updateQuantity(pecaId, quantidade)`: no branch `quantidade < 1` (remoção via zero), aplicar exatamente a mesma lógica acima antes do `setItems(next)`.
- `addPart`: **sem mudança** — o auto-vínculo em primeira adição segue funcionando; se o gatilho for adicionado numa sessão nova, o flag já está `false`.
- Reset do flag para `false` junto dos outros `setItems([])`:
  - dentro de `handleClose()`
  - dentro do `onSuccess` de `createRequest`

### 2. `src/pages/Pedidos.tsx`

Mesmo padrão, mesmo nome `autoLinkDismissed`:

- Novo estado no mesmo componente que hospeda `applyAutoLinks`/`itens`/`form`.
- `applyAutoLinks(list)`: guard inicial `if (autoLinkDismissed) return list;`.
- `removeItem(index)`:
  - identificar `removed = itens[index]`, `targetId = findPecaIdByCodigo(AUTO_LINK_TARGET_CODE)`, `triggerId = solenoideId`
  - se `removed?.peca_id === targetId` → `setAutoLinkDismissed(true)`
  - se `removed?.peca_id === triggerId` → `setAutoLinkDismissed(false)` (junto do reset atual de `solenoide_modelo`)
- `updateItem`, `incrementQuantity`, `decrementQuantity`: **sem mudança de assinatura**; a proteção vem do guard em `applyAutoLinks`. Se `updateItem` trocar o `peca_id` de uma linha e essa linha era o alvo, o mesmo cenário do usuário (linha do alvo deixa de existir) ocorre; a decisão neste plano é **não** tratar `updateItem` como remoção explícita — o usuário disse "aplicar o mesmo padrão", e o padrão nos outros dois arquivos é reagir apenas a remoções explícitas. Assim mantemos comportamento simétrico entre updateItem/increment/decrement (todos apenas honram o flag).
- Reset do flag para `false` junto de cada `setItens([])` já existente (linhas ~358, ~524, ~611).

## Comportamento preservado

- Primeira adição do gatilho PRD00605 em sessão nova continua inserindo PRD00639 automaticamente (flag inicia `false`).
- Remoção do gatilho zera o flag: adicionar o gatilho de novo volta a inserir o alvo.
- Nenhuma outra lógica (mutations, filtros, render, cronômetro, etc.) é alterada.
