# Fase 6 — Aba "Pendentes" e contador no menu

A tela de Solicitação de Peças ganha uma terceira aba "Pendentes", com as coletas reversas paradas aguardando ação, e o menu lateral passa a mostrar um contador das pendências do próprio usuário.

## O que muda

1. Nova aba "Pendentes" ao lado de "Rascunhos" e "Transmitidos", com contador de itens.
   - Lista as solicitações em "Pendente" das quais o usuário é responsável (técnico, CSM, ou solicitante quando a coleta é pelos Correios).
   - Admin e coordenadores veem todas as pendências, de qualquer responsável.
   - Cada item tem o botão "Processar" (o mesmo diálogo de Código de Rastreio da fase anterior) para quem pode agir.
2. A aba só aparece na visão "Coleta Reversa" ou "Todos". Na visão "Envios" ela não existe, porque um envio nunca fica pendente.
3. No menu lateral, o item "Coleta Reversa" (dentro de "Solicitação de Peças") mostra um selo com o número de pendências do usuário logado — só as dele, mesmo para admin. O selo desaparece quando é zero e atualiza automaticamente quando uma pendência é processada.

## Detalhes técnicos

**`src/pages/Pedidos.tsx`**
- `activeTab` passa a ser `'rascunhos' | 'pedidos' | 'pendentes'`; `TabsList` vira `grid-cols-3` quando a aba Pendentes está visível (`showPendentesTab = tipoSolicitacaoFilter !== 'envio'`), senão continua `grid-cols-2`.
- Novo memo `pendenciasVisiveis`: `pedidos.filter(p => p.status === 'pendente' && (canManagePedidos || isResponsavelPendencia(p)))`. `TabsTrigger` "Pendentes" (ícone `AlertTriangle`) com `Badge` da contagem.
- `filteredAndSortedPedidos`: quando `activeTab === 'pendentes'`, a `source` passa a ser `pendenciasVisiveis` (os filtros de busca/data/tipo continuam se aplicando; o filtro de status é ignorado, como já ocorre em rascunhos). `paginatedPedidos`/`totalPages` seguem a mesma regra da aba "Transmitidos".
- Efeito de segurança: se `showPendentesTab` virar falso (usuário navega para "Envios") e `activeTab === 'pendentes'`, volta para `'pedidos'`.
- Render: novo ramo `activeTab === 'pendentes'` com a mesma lista de cards já usada na visão somente-leitura (código, badges de status/tipo, cliente, itens, data) mais os botões "Processar" (quando `canManagePedidos || isResponsavelPendencia(pedido)`) e "Detalhes", reaproveitando `setPendenciaPedido` e o `ProcessarPendenciaDialog` já montado na página. Estado vazio próprio ("Nenhuma pendência").
- Abas "Rascunhos"/"Transmitidos", Kanban, filtros e demais diálogos ficam inalterados.

**Contador no menu — novo hook `src/hooks/usePendenciasCount.ts`**
- `useQuery` com key `['pedidos', 'pendencias-count', user?.id]` (prefixo `['pedidos']`, portanto já é invalidado pelas invalidações existentes de `['pedidos']` — sem polling novo).
- Consulta: `supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('status', 'pendente').or('tecnico_responsavel_user_id.eq.<uid>,csm_responsavel_user_id.eq.<uid>,and(tipo_coleta.eq.correios,solicitante_id.eq.<uid>)')`; `enabled: !!user?.id`; retorna `count ?? 0`.

**`src/components/layout/AppSidebar.tsx`**
- Usa o hook e, no item de submenu cujo `permKey === 'pedidos_coleta_reversa'`, renderiza um `Badge` (`h-5 px-1.5 ml-auto`) com a contagem quando maior que zero. Nenhuma mudança de rota, permissão ou estrutura do menu.

**Sem migration** — nenhuma mudança de schema nesta etapa.

## Validação
Typecheck + build e teste no preview: conferir que a aba aparece em "Coleta Reversa"/"Todos" e não em "Envios", que a lista traz as pendências certas, que o "Processar" abre o diálogo e que o selo do menu atualiza sozinho após processar.
