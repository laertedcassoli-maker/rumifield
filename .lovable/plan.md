## Objetivo
Replicar no RelatorioPreventivo.tsx a funcionalidade de download PDF já implementada no RelatorioCorretivo.tsx, com as adaptações necessárias para o contexto preventivo.

## Alterações em `src/pages/preventivas/RelatorioPreventivo.tsx`

### 1. Importações adicionais
- Adicionar `useSearchParams` do `react-router-dom`
- Adicionar `Download` do `lucide-react`

### 2. Hook de search params
- Declarar `const [searchParams] = useSearchParams()` após os estados existentes

### 3. Função `handleDownloadPdf`
- Implementar com mesma lógica do RelatorioCorretivo.tsx:
  1. Exibir toast "Gerando PDF..." (30s)
  2. Converter todas as `<img>` dentro de `#report-content` para base64 (fetch → blob → FileReader), ignorando src que já comece com `data:`
  3. Aguardar 500ms
  4. Gerar PDF via `html2pdf.js` com configuração idêntica (A4, jpeg 0.92, scale 2, useCORS, pagebreak avoid-all/css/legacy)
  5. Filename: `relatorio-preventivo-${report.preventive.public_token.slice(0, 8)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
  6. Dismiss do toast e feedback de sucesso/erro

### 4. useEffect para PDF via parâmetro de URL
- Disparar `handleDownloadPdf()` quando `searchParams.get('acao') === 'pdf'` e `report && imageLoadAttempted`

### 5. Wrapper `id="report-content"`
- Envolver `<header>` + `<main>` em `<div id="report-content" className="min-h-screen bg-gradient-to-b from-muted/30 to-background">`
- Transferir `data-pdf-root` e `data-pdf-capture` do div externo para o novo wrapper

### 6. Botões no header
- Substituir o botão único "Compartilhar" por um container `flex gap-2` com:
  - Botão "Compartilhar" (Share2)
  - Botão "Baixar PDF" (Download) — chama `handleDownloadPdf`

### 7. Ajustes de layout para impressão PDF
- Adicionar `break-inside-avoid` em cada `<Card>` do main (visit-info, checklist, parts, photos, observations)
- Adicionar `break-inside-avoid` em cada item do checklist (`<div key={item.id} className="p-2 rounded-lg ...">`)
- Adicionar `break-inside-avoid` em cada foto/vídeo (`<div key={m.id} className="relative aspect-square ...">`)
- Grid de fotos: alterar `grid grid-cols-2 gap-2` para `grid grid-cols-2 gap-3 print:grid-cols-1`

## Fora do escopo
- Nenhuma alteração em queries, estados, lógica de signed URLs, ou outros componentes
- `html2pdf.js` já está instalado e tipado (`src/types/html2pdf.d.ts` já existe)