# Navegação entre pedidos vinculados (Envio ↔ Coleta Reversa)

Objetivo: no detalhe da solicitação de peças, mostrar as coletas reversas geradas por um envio (e o envio de origem de uma coleta reversa), permitindo abrir cada uma delas dentro do mesmo dialog e voltar nível por nível.

## O que o usuário verá

- Ao abrir um **Envio** que gerou coleta(s) reversa(s): novo bloco "Coleta(s) Reversa(s) vinculada(s)" com um card por coleta (código + situação), clicável.
- Ao abrir uma **Coleta Reversa** com origem: novo bloco "Envio de origem" (código + situação), clicável.
- Clicar num card troca o conteúdo do dialog para esse pedido; aparece um botão **Voltar** no topo, que retorna ao pedido anterior — funciona em cadeia (envio → reversa → envio → ...).
- Pedidos sem vínculo continuam exatamente como hoje: nenhum bloco novo, nenhum botão Voltar.
- Fechar o dialog limpa toda a navegação; abrir outro pedido começa do zero.

## Detalhes técnicos

**src/pages/Pedidos.tsx**

1. Trocar `const [viewingPedido, setViewingPedido] = useState<any>(null)` (linha 196) por:
   - `const [viewingStack, setViewingStack] = useState<any[]>([])`
   - `const viewingPedido = viewingStack[viewingStack.length - 1] ?? null`
   - `const setViewingPedido = useCallback((next) => ...)`: shim que aceita valor ou updater e substitui **apenas o topo** da pilha (`null` → limpa a pilha inteira). Assim os usos existentes (linhas 656, 1081, 1095, 2083, 2178, 2250, 2283, 2526 e o `onOpenChange` da linha 2264) continuam válidos sem alteração, e abrir da listagem com um pedido novo inicia a pilha com um item só — o shim detecta `id` diferente do topo e reinicia a pilha.
   - Novas funções: `pushPedido(p)` → `setViewingStack(s => [...s, p])`; `popPedido()` → remove o topo (e `setIsEditingSolicitado(false)`).

2. Buscar vínculos com React Query (chamada direta ao Supabase, online):
   - `useQuery(['pedido-vinculos', viewingPedido?.id, viewingPedido?.tipo_solicitacao, viewingPedido?.coleta_reversa_origem_id], enabled: !!viewingPedido)`
   - Se `tipo_solicitacao === 'envio'`: `select('id, pedido_code, status, tipo_solicitacao, tipo_coleta, coleta_reversa_origem_id, cliente_id, created_at, ...campos usados no dialog, clientes(nome, fazenda), pedido_itens(*, pecas(...), pedido_item_assets(...))').eq('coleta_reversa_origem_id', id)` → lista de coletas.
   - Se `tipo_solicitacao === 'coleta_reversa' && coleta_reversa_origem_id`: mesmo select com `.eq('id', coleta_reversa_origem_id).maybeSingle()` → origem.
   - O select reaproveita exatamente a mesma projeção usada na query principal `pedidos`, para que o pedido empilhado renderize o dialog completo (itens, assets, NF).

3. UI dentro do dialog (bloco com `bg-muted/50 rounded-lg p-3 border`, igual às seções existentes), inserido após a seção de itens/observações:
   - Envio: título "Coleta(s) Reversa(s) vinculada(s)" + cards clicáveis (`pedido_code` em fonte mono + `Badge` de status com `statusColors/statusLabels`), `onClick={() => pushPedido(c)}`.
   - Coleta reversa: título "Envio de origem" com um card no mesmo formato.
   - Renderizados só quando há resultado (`length > 0` / origem encontrada).

4. Cabeçalho (linha ~2266): quando `viewingStack.length > 1`, exibir botão `Voltar` (ícone `ArrowLeft`, `variant="ghost" size="sm"`) antes do título, chamando `popPedido()`.

5. `EditarPedidoSolicitado` continua igual: `pedido={viewingPedido}` (topo da pilha) e `onSaved` grava via o shim, substituindo apenas o topo.

Nada de Dexie/offline, nenhuma alteração em badges do Kanban (fica para o próximo passo), nem em status, cliente, solenoide, itens, tipo de envio/coleta ou responsável.
