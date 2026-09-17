# Filtro "Tipo de Solicitação" na aba Transmitidos (Pedidos.tsx)

Arquivo único: `src/pages/Pedidos.tsx`. Nenhuma migration, nenhum schema, nenhuma outra tela.

## 1. Estado
- Ao lado de `tipoEnvioFilter`/`tipoLogisticaFilter` (~linha 172):
  `const [tipoSolicitacaoFilter, setTipoSolicitacaoFilter] = useState<'all' | 'envio' | 'coleta_reversa'>('all');`

## 2. Lógica de filtragem
- No `useMemo` de filtragem (~linhas 236–257), após `matchesTipoLogistica`:
  - `let matchesTipoSolicitacao = true;`
  - se `'envio'` → `pedido.tipo_solicitacao === 'envio'`; se `'coleta_reversa'` → `=== 'coleta_reversa'` (com fallback `(pedido as any).tipo_solicitacao ?? 'envio'` para linhas antigas em cache).
- Incluir `matchesTipoSolicitacao` no `return` final (linha ~257).
- Adicionar `tipoSolicitacaoFilter` às dependências dos três `useEffect`/`useMemo` existentes (~linhas 276 e 293) — o reset de página já decorre do effect de filtros.

## 3. UI (aba Transmitidos apenas)
- Novo grupo de botões toggle imediatamente após o grupo "Logística:" (~linha 1571), mesmo padrão (`activeTab === 'pedidos'`, `flex items-center gap-2 flex-wrap`, label `text-sm text-muted-foreground` "Solicitação:", botões `size="sm"` `className="h-7 text-xs"`):
  - "Todos" → `variant={tipoSolicitacaoFilter === 'all' ? 'secondary' : 'outline'}`, `onClick={() => setTipoSolicitacaoFilter('all')}`.
  - "Envios" → `variant={...=== 'envio' ? 'default' : 'outline'}`, `onClick` toggle: `setTipoSolicitacaoFilter(tipoSolicitacaoFilter === 'envio' ? 'all' : 'envio')`.
  - "Coleta Reversa" → idem com `'coleta_reversa'`, com ícone `RefreshCcw` (h-3 w-3) como os demais grupos usam ícones.
- Clicar de novo no botão ativo volta para "Todos" (mesmo comportamento dos filtros existentes).

## 4. Limpar filtros
- `clearFilters` (~linha 304): adicionar `setTipoSolicitacaoFilter('all');`.
- Condição de exibição do botão X (~linha 1465): incluir `tipoSolicitacaoFilter !== 'all'`.

## O que NÃO muda
- `tipoEnvioFilter`, `tipoLogisticaFilter`, `statusFilter`, `dateFilter`, `solicitanteFilter`, ordenação, paginação, abas, formulário, Rascunhos, dialog de detalhe (fica para o próximo prompt).

## Critérios de aceite
- "Envios" mostra só `tipo_solicitacao='envio'`; "Coleta Reversa" só `='coleta_reversa'`; "Todos" (ou re-clique) mostra ambos.
- Novo filtro combina com todos os filtros existentes.
- Filtro aparece só na aba "Transmitidos"; Rascunhos intocado.

## Validação
- Build OK em /tmp/observability/build-errors.log; teste Playwright no preview alternando os filtros e conferindo contagem de linhas.
