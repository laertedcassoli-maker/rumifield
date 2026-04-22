

## Diagnóstico

A mensagem "offline" no preview vem do `OfflineBanner` (topo) ou do `OfflineIndicator`/badges em telas como `/pedidos` e `ClientesList`. Eles usam `navigator.onLine` + listeners `online/offline` via `useOfflineSync`.

**Causa provável no preview Lovable:**
1. O preview roda dentro de **iframe** + Service Worker do PWA está ativo (vite-plugin-pwa). Em iframes, `navigator.onLine` pode reportar `false` esporadicamente, ou o SW intercepta requests e a heurística de "online" do hook falha.
2. O guia oficial do Lovable (seção PWA) diz explicitamente: **não registrar Service Worker em iframe/preview** — caso contrário causa cache stale, falsos offline, problemas de navegação. Hoje o `vite.config.ts` registra o SW sempre, sem `devOptions.enabled: false` e sem guarda no `main.tsx`.
3. Pode haver um SW antigo registrado no domínio do preview servindo respostas em cache, fazendo o hook achar que está offline.

## Plano

### 1. `vite.config.ts`
Adicionar `devOptions: { enabled: false }` no bloco `VitePWA` para que o SW não rode em dev/preview, apenas em produção.

### 2. `src/main.tsx`
Adicionar guarda **antes** de qualquer registro: se `window.self !== window.top` (iframe) **ou** hostname contém `id-preview--` / `lovableproject.com`, desregistrar todos SWs existentes e pular registro. Isso limpa SWs antigos que já estão poluindo o preview atual.

### 3. Sem mudanças nos componentes de UI offline
`OfflineBanner`, `OfflineIndicator` e `useOfflineSync` continuam funcionando normalmente em produção (rumifield.lovable.app) e no app instalado. Apenas o preview Lovable deixa de ter SW.

### 4. Pós-deploy
O usuário precisa **fazer hard refresh** (Ctrl+Shift+R) ou abrir DevTools → Application → Service Workers → Unregister, **uma única vez**, para remover o SW que já está instalado no preview. Depois disso o banner offline some.

### Fora do escopo
- Não alterar lógica de detecção de online/offline em produção.
- Não remover PWA — continua ativo no published URL e no app instalado.
- Não mexer em cache strategies do workbox.

