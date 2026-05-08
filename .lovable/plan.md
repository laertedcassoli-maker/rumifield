## Objetivo

Em todos os botões "Compartilhar" de visitas finalizadas (preventivas e corretivas), além do link já enviado hoje pelo `navigator.share`, anexar também um **PDF com o mesmo conteúdo e layout** do relatório público acessado pelo link. Sem alterar destinos, fluxo, conteúdo ou layout do relatório atual.

## Locais a alterar

Todos onde já existe o botão Compartilhar hoje:

1. `src/pages/preventivas/AtendimentoPreventivo.tsx` — botões **Produtor** e **Time Interno**
2. `src/pages/preventivas/ExecucaoRota.tsx` — botão **Compartilhar** da visita finalizada
3. `src/pages/preventivas/RelatorioPreventivo.tsx` — botão **Compartilhar** dentro da página pública
4. `src/pages/chamados/RelatorioCorretivo.tsx` — botão **Compartilhar** do relatório corretivo
5. `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` — botão **Compartilhar** da visita corretiva

## Estratégia técnica (sem custo de edge function)

Geração 100% client-side. Justificativa: para anexar arquivo no menu nativo (WhatsApp, e-mail, etc.) o `navigator.share` exige um `File` JS no próprio dispositivo — gerar no servidor obrigaria download extra sem ganho.

### Bibliotecas

Adicionar duas dependências leves (~150 KB gzip somadas):
- `html2canvas` — rasteriza um nó DOM em canvas
- `jspdf` — monta o PDF a partir do canvas, com paginação A4

Ambas já são padrão do ecossistema React e funcionam em PWA/iOS Safari.

### Helper compartilhado novo

Criar `src/lib/share-report-pdf.ts` exportando:

```text
shareReportWithPdf({
  url,             // mesma URL pública usada hoje
  title,           // título atual passado para navigator.share
  text,            // texto atual
  fileName,        // ex.: "relatorio-fazenda-X.pdf"
})
```

Fluxo interno:

```text
1. Cria iframe oculto (display:none, 1024px largura) apontando para `url`.
2. Aguarda `load` + pequeno delay para imagens/fonts (Promise.all sobre document.fonts.ready
   e img.complete dentro do iframe).
3. Roda html2canvas no <body> do iframe (scale 2 para nitidez).
4. Quebra o canvas em páginas A4 e gera Blob via jsPDF.
5. Monta `File` (application/pdf).
6. Tenta `navigator.share({ files:[file], title, text, url })` se canShare({files}) = true.
7. Fallbacks (na ordem):
   a. `navigator.share({ title, text, url })` — fluxo atual sem PDF (mantém destino nativo).
   b. Download local do PDF + clipboard do link + toast (cenário desktop sem share).
8. Remove o iframe ao final (try/finally).
```

### Substituições nos componentes

Cada handler de "Compartilhar" hoje monta `shareData` e chama `navigator.share`. Vamos trocar por uma chamada única:

```text
await shareReportWithPdf({
  url,
  title: shareData.title,
  text: shareData.text,
  fileName: `relatorio-${slug(client.nome)}-${visitCode}.pdf`,
});
```

Toasts atuais ("Link copiado", "Cole no WhatsApp", erros) continuam disparando dentro do helper para preservar UX.

### Considerações importantes

- **Conteúdo idêntico ao link**: como capturamos o iframe carregando exatamente a URL do relatório, o PDF é o snapshot fiel do que o destinatário veria — zero divergência.
- **Imagens do storage**: o relatório usa imagens do bucket `relatorios-publicos` (público) e logos importados; html2canvas exige `useCORS: true`, que já funciona pra storage público.
- **Versão "Interno" do relatório preventivo**: a URL `/relatorio/:token/interno` também renderiza a mesma página, então o mesmo helper serve.
- **iOS Safari**: `navigator.canShare({ files })` é suportado desde 15.4. Em versões antigas cai no fallback mantendo o comportamento atual.
- **Performance**: geração leva ~2-4s para um relatório típico. Adicionar estado `sharing` nos botões para mostrar `Loader2` e impedir cliques duplicados.

## Não muda

- Layout e conteúdo do relatório público (`RelatorioPreventivo`, `RelatorioCorretivo`).
- URLs e tokens de compartilhamento.
- Lista de destinos (mesmo menu nativo do SO).
- Texto, título e link já enviados.
- Backend (sem migrations, sem edge functions, sem custo extra).

## Critério de aceite

- Em qualquer botão Compartilhar de visita finalizada, ao acionar, o menu nativo aparece com **link + PDF anexado**.
- O PDF abre com o mesmo layout do relatório público.
- Em navegadores sem suporte a compartilhar arquivos, o link continua sendo compartilhado/copiado normalmente (comportamento atual preservado).
