
## Adicionar botoes de compartilhamento no encerramento da visita corretiva

### Problema
O `public_token` ja e gerado no checkout da visita corretiva e a pagina de relatorio publico (`/relatorio-corretivo/:token`) ja existe, mas a tela de execucao da visita corretiva nao exibe botoes de compartilhamento apos o encerramento -- apenas "Ver Chamado" e "Minhas Rotas".

### Solucao
Adicionar botoes "Produtor" e "Time Interno" na secao de visita encerrada, replicando o mesmo padrao ja usado nas preventivas (`AtendimentoPreventivo.tsx`).

### Alteracao

**`src/pages/chamados/ExecucaoVisitaCorretiva.tsx`** (unico arquivo)

Na secao "Share Section" (linhas ~629-671), adicionar:

1. Importar `Share2` do lucide-react (ja importado parcialmente)
2. Quando `visit.publicToken` existir, exibir dois botoes de compartilhamento:
   - **Produtor**: link para `/relatorio-corretivo/{token}` com Web Share API ou fallback clipboard
   - **Time Interno**: link para `/relatorio-corretivo/{token}/interno` com mesmo comportamento
3. Manter os botoes existentes "Ver Chamado" e "Minhas Rotas" abaixo

A logica de compartilhamento segue o padrao existente:
- Detecta hostname `lovableproject.com` para usar dominio de producao (`rumifield.lovable.app`)
- Usa `navigator.share()` quando disponivel
- Fallback para `navigator.clipboard.writeText()` com toast de confirmacao
