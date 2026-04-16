

## Plano aprovado — execução

### 1. `vite.config.ts`
Substituir bloco `workbox` inteiro pela configuração nova:
- `skipWaiting: true` + `clientsClaim: true`
- 6 regras `runtimeCaching` na ordem especificada (auth → storage → referência → preventivas → rest genérico → catch-all)

### 2. `src/main.tsx`
Sem alterações. `registerType: "autoUpdate"` mantém-se.

### 3. `src/pages/chamados/Index.tsx`
Sem alterações. `refetchOnMount: 'always'` permanece como defesa.

### 4. Memory
Atualizar `mem://arquitetura/estrategia-pwa` com nova estratégia de cache (NetworkFirst para transacionais, CacheFirst só para referência/storage).

### Observação ao usuário pós-deploy
Fechar totalmente o PWA no celular (remover da lista de apps abertos) e reabrir para o novo Service Worker entrar em efeito.

