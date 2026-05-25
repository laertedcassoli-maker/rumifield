# Plano: Botão "Baixar PDF" no Relatório Corretivo

Alterações restritas a `src/pages/chamados/RelatorioCorretivo.tsx` + instalação de uma dependência.

## 1. Dependência
- `bun add html2pdf.js`

## 2. Edições em `src/pages/chamados/RelatorioCorretivo.tsx`

**Importações**
- Adicionar `useSearchParams` em `react-router-dom`.
- Adicionar `Download` em `lucide-react`.

**Estado**
- Após os states existentes: `const [searchParams] = useSearchParams();`

**Nova função `handleDownloadPdf`** (após `handleShare`):
- Mostra toast "Gerando PDF..." com `duration: 30000` e captura `dismiss`.
- Converte todas as `<img>` dentro de `#report-content` para base64 via `fetch` → `blob` → `FileReader` (ignora `data:` e falhas silenciosamente).
- Aguarda 500ms.
- Importa dinamicamente `html2pdf.js` e gera PDF do elemento `#report-content` com:
  - margin `[10,10,10,10]`
  - filename `relatorio-${report.corrective.visit_code}-${yyyy-MM-dd}.pdf`
  - image jpeg 0.92, html2canvas `{ scale:2, useCORS:true, allowTaint:true, logging:false, imageTimeout:15000 }`
  - jsPDF A4 portrait
  - pagebreak `['avoid-all','css','legacy']`
- Toast de sucesso ou erro destrutivo.

**Novo `useEffect`** (após os existentes):
- Se `searchParams.get('acao') === 'pdf'` e `report` e `imageLoadAttempted` → chama `handleDownloadPdf()`.

**Estrutura JSX**
- Envolver `<header>` + `<main>` existentes em `<div id="report-content" className="min-h-screen bg-gradient-to-b from-muted/30 to-background">` (sem alterar o conteúdo interno).
- Substituir o único botão "Compartilhar" do header por um `<div className="flex gap-2">` contendo:
  - Botão outline sm com `Share2` → `handleShare` ("Compartilhar")
  - Botão outline sm com `Download` → `handleDownloadPdf` ("Baixar PDF")

**Ajustes de quebra de página**
- Adicionar `break-inside-avoid` às classes de cada `<Card>` dentro do `<main>`.
- Adicionar `break-inside-avoid` em cada item do checklist (`<div key={item.id} className="p-2 rounded-lg ...">`).
- Adicionar `break-inside-avoid` em cada foto/vídeo (`<div key={m.id} className="relative aspect-square ...">`).
- Trocar o grid de fotos `grid grid-cols-2 gap-2` por `grid grid-cols-2 gap-3 print:grid-cols-1`.

## Fora de escopo
- Não alterar queries, estados, lógica de signed URLs ou qualquer outro trecho do componente.
- Não tocar em `share-report-pdf.ts` nem em outras páginas (Preventivo, Execução, etc.).
