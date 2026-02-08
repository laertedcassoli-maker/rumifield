
## Corrigir visualizacao de visitas corretivas sem relatorio publico na tela 360

### Problema
Quando uma visita corretiva nao possui `public_token` (ex: visitas antigas finalizadas antes da funcionalidade de relatorio), o sistema usa como fallback o link `/chamados/visita/:id`, que e uma pagina completa do app (com sidebar e menu). Ao ser carregada dentro do iframe do modal `TimelineEventModal`, mostra toda a interface duplicada.

### Solucao

**Arquivo: `src/components/crm/ClienteHistoricoTab.tsx`** (unica alteracao)

Na construcao do timeline para corretivas (linha ~196), alterar o fallback:
- Se tem `publicToken`: manter link `/relatorio-corretivo/{token}` (abre no iframe do modal)
- Se NAO tem `publicToken`: definir `link: undefined` para que o modal exiba apenas as informacoes basicas (tipo, status, data) sem iframe

Isso evita carregar uma pagina completa da aplicacao dentro do iframe do modal. O botao "Abrir pagina completa" (Maximize2) no modal so aparece quando ha link, entao o usuario ainda pode navegar ao chamado pela timeline do chamado correspondente.

### Alteracao de codigo

```typescript
// Antes (linha 196):
link: publicToken ? `/relatorio-corretivo/${publicToken}` : `/chamados/visita/${v.id}`,

// Depois:
link: publicToken ? `/relatorio-corretivo/${publicToken}` : undefined,
```

### Nota sobre dados historicos
A visita CORR-2026-00002 nao possui registro em `corrective_maintenance`, por isso o `public_token` e nulo. Para visitas futuras, o token e gerado automaticamente no checkout. Nao sera necessario criar migracao para gerar tokens retroativos, mas isso pode ser considerado futuramente se desejado.
