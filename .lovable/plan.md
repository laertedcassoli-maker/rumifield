

## Problema

O botao de refresh no header faz uma atualizacao pesada de Service Worker e cache do PWA, mas nao invalida o cache do React Query (que e o que realmente controla os dados exibidos na tela). Alem disso, respostas HTTP podem estar sendo cacheadas pelo runtime cache do Service Worker, servindo dados antigos mesmo apos o refetch.

## Solucao

Duas mudancas principais:

### 1. Tornar o botao de refresh mais inteligente

Alterar o botao de refresh no header para **invalidar todo o cache do React Query** antes de recarregar. Isso forca todas as queries a buscarem dados frescos do servidor.

- Exportar o `queryClient` do `App.tsx` para que possa ser importado no `AppLayout.tsx`
- No `handleForceRefresh`, chamar `queryClient.invalidateQueries()` antes da recarga
- Alternativamente, adicionar `queryClient.clear()` para limpar completamente o cache

### 2. Adicionar refetch automatico ao focar a janela

Configurar o `QueryClient` com `refetchOnWindowFocus: true` (ja e o default) e um `staleTime` curto para garantir que os dados sejam revalidados quando o usuario volta para a aba.

---

## Detalhes tecnicos

### Arquivo: `src/App.tsx`
- Mover a criacao do `queryClient` para fora do arquivo ou exporta-lo
- Configurar defaults globais:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minuto
      refetchOnWindowFocus: true,
    },
  },
});
```

### Arquivo: `src/components/layout/AppLayout.tsx`
- Importar `useQueryClient` do `@tanstack/react-query`
- No `handleForceRefresh`:
  1. Chamar `queryClient.invalidateQueries()` para forcar refetch de todas as queries
  2. Manter o reload da pagina como fallback, mas com opcao de apenas invalidar sem recarregar

A logica ficara assim:

```text
Clique no botao refresh
  -> queryClient.invalidateQueries()  (forca refetch de dados)
  -> limpa caches HTTP do SW (runtime)
  -> forceServiceWorkerUpdateAndReload()
  -> reload com cache-buster
```

### Arquivo: `src/pages/admin/Usuarios.tsx`
- Adicionar `refetchOnWindowFocus: true` na query de usuarios como reforco local

### Resultado esperado
- Ao clicar no botao de refresh, os dados serao buscados novamente do banco
- Ao voltar para a aba do navegador, dados com mais de 1 minuto serao revalidados automaticamente
- O fluxo pesado de SW update continua funcionando para atualizar a versao do app

