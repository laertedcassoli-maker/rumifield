# Persistir filtros de MinhasRotas na URL

## Objetivo
Manter os 4 filtros (`filter`, `technicianFilter`, `typeFilter`, `statusFilter`) de `MinhasRotas.tsx` ao voltar das telas de execução (preventiva ou corretiva) ou ao usar o "voltar" do navegador, sincronizando-os com query params da URL.

## Mudanças

### 1. `src/pages/preventivas/MinhasRotas.tsx`
- Importar `useSearchParams` de `react-router-dom`.
- Substituir os 4 `useState` (linhas 128-132) por estado derivado dos searchParams, mantendo os defaults atuais:
  - `tipo` → `typeFilter` (default `all`)
  - `status` → `statusFilter` (default `ativas`)
  - `tecnico` → `technicianFilter` (default `all`)
  - `periodo` → `filter` (default `todas`)
- Handlers `setX` viram wrappers que chamam `setSearchParams(next, { replace: true })`, preservando os demais params e removendo o param quando o valor for o default (para manter a URL limpa).
- UI dos `Select`/botões permanece idêntica; só muda a fonte de verdade.

### 2. `src/pages/preventivas/ExecucaoRota.tsx`
Trocar os 3 `<Link to="/preventivas/minhas-rotas">` (linhas 488, 501, 521) por um `<button onClick={() => navigate(-1)}>` (ou `<Link>` equivalente que dispare `navigate(-1)`), mantendo o mesmo estilo/ícone. Assim a URL de origem (com query params) é restaurada pelo próprio histórico do browser.

### 3. `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
Mesma troca para os `<Link to="/preventivas/minhas-rotas">` das linhas 663, 945, 967, 979, 991-992, 1317-1318 — substituir por `navigate(-1)`. Nenhum outro fluxo (finalização, cancelamento) é alterado além do destino de retorno.

## Fora de escopo
- Nenhuma mudança em RLS, dados, componentes UI, ou em outras telas.
- Sem alterar o comportamento de submit/finalização das execuções — só o botão "voltar".

## Validação
- Aplicar filtros em Minhas Rotas → URL reflete os params.
- Abrir uma rota preventiva ou visita corretiva → voltar pelo botão da tela ou pelo browser → filtros preservados.
- Recarregar `/preventivas/minhas-rotas?tipo=preventivas&status=todos` → filtros aplicados no load.
