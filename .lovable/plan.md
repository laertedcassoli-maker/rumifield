## Diagnóstico

O PDF de relatório é gerado em `src/lib/share-report-pdf.ts` (usado por `RelatorioPreventivo.tsx` e `RelatorioCorretivo.tsx`). Hoje:

- `html2canvas` rasteriza o `<body>` inteiro num único canvas alto.
- O canvas é fatiado por `pageHeight` fixo do A4 → corta cards no meio entre páginas.
- `windowWidth: 1024` força o layout em desktop dentro de iframe estreito.
- Imagens vindas de Supabase Storage (signed URLs) entram nos `<img>` sem `crossOrigin="anonymous"`, então `useCORS: true` não as inclui no canvas → aparecem em branco no PDF.
- Não há margens nem cabeçalho/rodapé por página.

## Estratégia

Captura por seção (cada Card vira uma "seção PDF"), seguindo o padrão de paginação por blocos: cada seção é rasterizada individualmente, escalada para a largura útil (A4 – margens) e inserida na página corrente; quando não cabe no espaço restante, abre nova página.

## Mudanças

### 1. Marcar seções nas duas páginas de relatório

`src/pages/preventivas/RelatorioPreventivo.tsx` e `src/pages/chamados/RelatorioCorretivo.tsx`:

- Adicionar `data-pdf-section` em cada `<Card>` (Visit Info, Resumo, Peças, Fotos, Observações, etc.) e no `<header>`.
- Adicionar `data-pdf-root` no container principal para servir de escopo de busca.
- Em fotos, manter `<img>` mas adicionar `crossOrigin="anonymous"` quando estiver dentro do iframe de captura (detectado por `window.__PDF_CAPTURE__`).
- Garantir `loading="eager"` para imagens dentro do modo captura (impedir lazy).

### 2. Refatorar `src/lib/share-report-pdf.ts`

Substituir `generatePdfBlobFromIframe` por implementação seção-a-seção:

```text
A4 portrait: 210 x 297 mm
margins: 12 mm (top/bottom), 10 mm (left/right)
content width: 190 mm
section gap: 4 mm
```

Pseudocódigo:

```text
- antes de capturar: marcar iframe.contentWindow.__PDF_CAPTURE__ = true e
  forçar reload dos <img> com crossOrigin para que o navegador refaça as
  requests com CORS antes do html2canvas
- esperar todas as imagens (com novo crossOrigin) carregarem
- coletar nodes [data-pdf-section] dentro de [data-pdf-root]
- para cada seção:
    canvas = html2canvas(section, { useCORS, scale: 2, backgroundColor: '#fff',
                                     windowWidth: section.offsetWidth })
    h_mm = canvas.height * (contentWidth / canvas.width) * (1/2)  // compensar scale
    se h_mm > pageHeight - 2*margin → fatiar verticalmente em partes que caibam
      (slicing dentro da própria seção, mas só quando a seção sozinha excede a página)
    senão se h_mm > espaço restante → addPage(); currentY = marginTop
    addImage(jpeg 0.92) em (marginLeft, currentY, contentWidth, h_mm)
    currentY += h_mm + gap
- adicionar rodapé "Página X de Y" em cada página (pdf.setPage)
```

Detalhes técnicos:

- `scale: 2` no html2canvas para nitidez; dividir por 2 ao converter px→mm.
- `useCORS: true`, `allowTaint: false`, `backgroundColor: '#ffffff'`.
- Antes de capturar, percorrer `iframe.contentDocument.images` e: se `src` for http(s) e o atributo `crossOrigin` não estiver setado, clonar o `<img>` com `crossOrigin="anonymous"` para forçar nova request CORS; aguardar `load`/`error` antes de seguir.
- Para seções maiores que uma página (ex.: checklist enorme), aplicar slicing interno apenas nesse caso, usando duplicate canvas e offset `position`, mas só dentro daquela seção (não no documento todo). Isso evita corte no meio de outros cards.
- Adicionar cabeçalho fixo em cada página (logos miniatura + título + cliente) e rodapé "Página X / Y · © RumiField {ano}", usando `pdf.text` com a fonte Helvetica embutida do jsPDF (evita problemas de fonte custom). O design visual rico permanece dentro das seções rasterizadas.
- `windowWidth` do html2canvas igual ao `offsetWidth` da seção; iframe segue em 1024px para preservar layout desktop original (≈ idêntico ao mobile do app por causa do `max-w-2xl`).

### 3. Carregamento de imagens

- No `RelatorioPreventivo` e `RelatorioCorretivo`, já há `createSignedUrl`. O Supabase Storage devolve CORS ok.
- Adicionar `crossOrigin="anonymous"` na tag `<img>` quando `window.__PDF_CAPTURE__` for true (detectado via `useEffect` na montagem do relatório). Isso garante que a requisição original já venha com CORS — html2canvas reaproveita a imagem em vez de fetch separado.
- No `waitForIframeReady`, aumentar o timeout de imagens para 10s e validar `naturalWidth > 0` para todas.

### 4. Preservar identidade visual

- Não criar layout PDF "from scratch": a aparência continua sendo a do componente React (Tailwind, design tokens, cores, tipografia). A mudança é apenas como a captura é paginada.
- Cabeçalho/rodapé por página são adições leves em texto vetorial (Helvetica) para legibilidade e rastreabilidade — não substituem o header visual da seção 0.

### 5. Cenários de validação (a verificar manualmente após implementação)

- Visita sem fotos, com poucos itens → 1 página, sem espaços vazios estranhos.
- Visita com checklist longo (vários blocos/itens) → quebra correta entre blocos, sem cortar item ao meio.
- Visita com 10+ fotos → grid 2 colunas, fotos visíveis com proporção mantida.
- Observações longas (texto corrido) → seção sozinha pode passar de uma página: slicing controlado dentro dela.
- Iframe em viewport pequeno (mobile) → layout final do PDF não muda, pois iframe é fixado em 1024px durante captura.

## Arquivos a alterar

- `src/lib/share-report-pdf.ts` — nova lógica de paginação por seção e CORS de imagens.
- `src/pages/preventivas/RelatorioPreventivo.tsx` — adicionar `data-pdf-root`/`data-pdf-section` e `crossOrigin` condicional nas imagens.
- `src/pages/chamados/RelatorioCorretivo.tsx` — mesmas marcações.

Sem mudanças de banco, sem novas dependências (html2canvas + jsPDF já instalados).

## Riscos e mitigação

- **Tamanho do PDF**: JPEG 0.92 mantém arquivo razoável; manter `scale: 2`.
- **CORS de Supabase**: se algum bucket falhar CORS, a imagem aparece com placeholder; logar warning e seguir.
- **Seções gigantes**: slicing interno mantém continuidade visual (sem cortar entre seções diferentes).
