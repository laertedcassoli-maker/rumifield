## Contexto
O arquivo `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` contém uma seção "Visita Encerrada" com dois botões genéricos "Produtor" e "Time Interno" que usam a função `shareReportWithPdf`. O usuário solicitou um novo layout mais explícito e funcional.

## Alterações

### 1. Imports
Adicionar ao bloco de imports do lucide-react:
- `ExternalLink`
- `Link2`
- `Download`

### 2. Variáveis de URL
Dentro do componente, adicionar as variáveis de URL mantendo a lógica de detecção de origem:
```
const origin = window.location.hostname.includes('lovableproject.com')
  ? 'https://rumifield.lovable.app'
  : window.location.origin;
const urlProdutor = `${origin}/relatorio-corretivo/${visit.publicToken}`;
const urlInterno = `${origin}/relatorio-corretivo/${visit.publicToken}/interno`;
```
**Nota:** o usuário especificou usar `visit.publicToken` diretamente nas URLs, não `ensureCorrectiveReportToken()` nem `buildReportShareUrl()`. Verificar se `visit.publicToken` está disponível naquele ponto do JSX (está, pois o bloco é condicional a `isVisitCompleted && visit.publicToken`).

### 3. Substituição do layout
Substituir o bloco `<div className="flex gap-2 pt-2">` com os dois botões "Produtor" e "Time Interno" (aproximadamente linhas 1117-1198) pelo novo layout fornecido pelo usuário, que inclui:
- Botão principal "Abrir Relatório" (abre URL pública em nova aba)
- Seção "Produtor" com botões "Copiar link" (navigator.share ou clipboard) e "Baixar PDF" (abre `?acao=pdf` em nova aba)
- Seção "Time Interno" com botões "Copiar link" e "Baixar PDF" similares

### 4. Preservação
Manter os botões "Ver Chamado" e "Minhas Rotas" (linhas ~1200-1221) exatamente como estão, abaixo do novo layout.

### Fora de escopo
Não alterar queries, estados, mutações, lógica de checklist, lógica de peças, lógica de geolocalização, nem nenhum outro trecho do arquivo.