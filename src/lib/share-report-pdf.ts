import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface ShareReportArgs {
  url: string;
  title: string;
  text: string;
  fileName: string;
  onPdfReady?: (result: { file: File; action: 'downloaded' | 'shared-with-file' }) => void;
  onPdfFailed?: (error: Error) => void;
}

export interface ShareReportResult {
  /** 'shared-with-file' | 'shared-link-only' | 'downloaded' | 'copied' */
  outcome: 'shared-with-file' | 'shared-link-only' | 'downloaded' | 'copied';
  copiedToClipboard?: boolean;
  pdfGenerated?: boolean;
  pdfStatus?: 'ready' | 'pending' | 'failed' | 'skipped';
}

export function buildReportShareUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, window.location.origin).toString();
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildReportFileName(prefix: string, code?: string | null): string {
  const parts = ['relatorio', slugify(prefix)];
  if (code) parts.push(slugify(code));
  parts.push(new Date().toISOString().slice(0, 10));
  return parts.filter(Boolean).join('-') + '.pdf';
}

// ============================================================
// A4 layout constants (mm)
// ============================================================
const A4_W = 210;
const A4_H = 297;
const MARGIN_X = 10;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 14;
const CONTENT_W = A4_W - MARGIN_X * 2;
const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM;
const SECTION_GAP = 3;
const SUBSECTION_GAP = 1.5;
// Extra millimetres added to each captured leaf height. html2canvas captures
// based on offsetHeight (line-height), which excludes letter descenders —
// without this bleed the next leaf's white background clips characters like
// 'g', 'p', 'y' from the previous leaf.
const LEAF_BLEED_MM = 1.2;
const H2C_SCALE = 2;
// Extra vertical buffer to absorb any sub-pixel rounding between html2canvas
// and jsPDF measurements, preventing the last line of a block from being
// clipped at the page edge.
const PAGE_SAFE_PADDING = 6;

// ============================================================
// Image CORS handling: rewrite cross-origin <img> tags to use
// crossOrigin="anonymous" so html2canvas can rasterize them.
// ============================================================
async function rewriteImagesForCors(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  const reloadPromises: Promise<void>[] = [];

  for (const img of imgs) {
    const src = img.src;
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;
    try {
      const u = new URL(src, doc.baseURI);
      const sameOrigin = u.origin === doc.location.origin;
      if (sameOrigin) continue;
    } catch {
      continue;
    }
    if (img.crossOrigin === 'anonymous') continue;

    reloadPromises.push(
      new Promise<void>((resolve) => {
        const originalSrc = img.src;
        const done = () => resolve();
        img.crossOrigin = 'anonymous';
        // Force re-fetch with the new crossOrigin attribute
        img.src = '';
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        // Reassign (cache-busted to ensure a fresh CORS request)
        const sep = originalSrc.includes('?') ? '&' : '?';
        img.src = `${originalSrc}${sep}_pdf=1`;
        // Safety timeout
        setTimeout(done, 8000);
      }),
    );
  }

  if (reloadPromises.length > 0) {
    await Promise.all(reloadPromises);
  }
}

async function waitForIframeReady(iframe: HTMLIFrameElement, timeoutMs = 20000): Promise<void> {
  const waitStart = Date.now();

  // Phase 1: wait for iframe document to exist & route to resolve
  while (Date.now() - waitStart < Math.min(timeoutMs, 8000)) {
    try {
      const doc = iframe.contentDocument;
      const href = iframe.contentWindow?.location?.href || '';
      const hasAppContent = !!doc?.body && doc.body.children.length > 0;
      const hasResolvedRoute = href !== 'about:blank';
      if (hasAppContent && hasResolvedRoute) break;
    } catch {
      void 0;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const doc = iframe.contentDocument;
  if (!doc?.body) throw new Error('Conteúdo do relatório indisponível');

  const win = iframe.contentWindow as (Window & { __REPORT_READY__?: boolean; __PDF_CAPTURE__?: boolean }) | null;
  if (win) {
    win.__PDF_CAPTURE__ = true;
    win.dispatchEvent(new Event('report-pdf-mode'));
  }

  // Inject capture-only styles: hide UI controls and force responsive images
  try {
    const style = doc.createElement('style');
    style.setAttribute('data-pdf-style', 'true');
    style.textContent = `
      [data-pdf-hide]{display:none !important;}
      img{max-width:100% !important;height:auto;}
      body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;}
    `;
    doc.head.appendChild(style);
  } catch {
    void 0;
  }

  // Phase 2: wait for ready marker OR error marker
  while (Date.now() - waitStart < timeoutMs) {
    const errorNode = doc.querySelector('[data-report-error="true"]');
    if (errorNode) throw new Error('Relatório indisponível para gerar PDF');

    const readyNode = doc.querySelector('[data-report-ready="true"]');
    const loadingNode = doc.querySelector('[data-report-loading="true"]');
    const readyFlag = !!win?.__REPORT_READY__;

    if (readyNode && !loadingNode && readyFlag) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!doc.querySelector('[data-report-ready="true"]')) {
    throw new Error('Tempo esgotado ao preparar relatório');
  }

  try {
    const fontSet = (doc as Document & { fonts?: FontFaceSet }).fonts;
    if (fontSet?.ready) await Promise.race([fontSet.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    void 0;
  }

  // Force CORS on cross-origin images so html2canvas can rasterize them
  await rewriteImagesForCors(doc);

  // Wait for all images to load (max 10s)
  const imgs = Array.from(doc.images || []);
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((res) => {
            if (img.complete && img.naturalWidth > 0) return res();
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          }),
      ),
    ),
    new Promise((r) => setTimeout(r, 10000)),
  ]);

  await new Promise((r) => setTimeout(r, 300));
}

// ============================================================
// Section-based PDF rendering
// ============================================================
async function captureSection(section: HTMLElement): Promise<HTMLCanvasElement> {
  // Add a few extra pixels of height so html2canvas doesn't crop letter
  // descenders ('g', 'p', 'y') that hang below the line-box offsetHeight.
  const extraPx = 6;
  return await html2canvas(section, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    scale: H2C_SCALE,
    imageTimeout: 15000,
    logging: false,
    windowWidth: section.ownerDocument.documentElement.clientWidth,
    height: section.offsetHeight + extraPx,
    windowHeight: section.ownerDocument.documentElement.clientHeight + extraPx,
  });
}

function drawFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 140);
  const year = new Date().getFullYear();
  pdf.text(`© RumiField ${year}`, MARGIN_X, A4_H - 6);
  const pageStr = `Página ${pageNum} de ${totalPages}`;
  const w = pdf.getTextWidth(pageStr);
  pdf.text(pageStr, A4_W - MARGIN_X - w, A4_H - 6);
  pdf.setTextColor(0, 0, 0);
}

// Find first-level descendants marked as subsections (stop descending once one is found).
function findFirstLevelSubsections(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child instanceof HTMLElement && child.hasAttribute('data-pdf-subsection')) {
        out.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return out;
}

function containsSubsections(node: HTMLElement): boolean {
  return !!node.querySelector('[data-pdf-subsection]');
}

function describePdfNode(node: HTMLElement): string {
  return (
    node.getAttribute('data-pdf-section') ||
    node.getAttribute('data-pdf-subsection') ||
    node.tagName.toLowerCase()
  );
}

function validateReportCaptureState(doc: Document) {
  const readyNode = doc.querySelector('[data-report-ready="true"]');
  if (!readyNode) {
    throw new Error('O relatório ainda não terminou de carregar para exportação');
  }

  const mediaCount = Number((readyNode as HTMLElement).getAttribute('data-report-media-count') || '0');
  if (mediaCount > 0) {
    const renderedMedia = doc.querySelectorAll('[data-report-media-item="true"]').length;
    const readyMedia = doc.querySelectorAll('[data-report-media-ready="true"]').length;
    if (renderedMedia < mediaCount || readyMedia < mediaCount) {
      throw new Error('As mídias do relatório ainda não terminaram de carregar');
    }
  }
}


async function generatePdfBlobFromIframe(iframe: HTMLIFrameElement): Promise<Blob> {
  const doc = iframe.contentDocument;
  if (!doc || !doc.body) throw new Error('Conteúdo do relatório indisponível');
  validateReportCaptureState(doc);

  // Find sections to render
  const root = doc.querySelector('[data-pdf-root]') || doc.body;
  const sectionNodes = Array.from(
    root.querySelectorAll<HTMLElement>('[data-pdf-section]'),
  ).filter((node) => node.getAttribute('data-pdf-section') !== 'footer');

  // Fallback: if the page wasn't instrumented, capture the whole body as one section
  const sections: HTMLElement[] = sectionNodes.length > 0 ? sectionNodes : [doc.body];

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const state = { currentY: MARGIN_TOP };
  const usableContentHeight = CONTENT_H - PAGE_SAFE_PADDING;

  const ensureNewPageIfNeeded = (neededMm: number) => {
    const remaining = A4_H - MARGIN_BOTTOM - state.currentY - PAGE_SAFE_PADDING;
    if (neededMm > remaining && state.currentY > MARGIN_TOP) {
      pdf.addPage();
      state.currentY = MARGIN_TOP;
    }
  };

  const placeCanvas = (canvas: HTMLCanvasElement, heightMm: number) => {
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      MARGIN_X,
      state.currentY,
      CONTENT_W,
      heightMm,
      undefined,
      'FAST',
    );
    state.currentY += heightMm;
  };

  // Capture a single node as one image, scaling down if it exceeds a full page.
  const renderLeaf = async (node: HTMLElement): Promise<number> => {
    if (!node.offsetWidth || !node.offsetHeight) return 0;
    let canvas: HTMLCanvasElement;
    try {
      canvas = await captureSection(node);
    } catch (err) {
      throw new Error(`Falha ao capturar o bloco "${describePdfNode(node)}" para o PDF`);
    }
    const widthPx = canvas.width / H2C_SCALE;
    const heightPx = canvas.height / H2C_SCALE;
    const ratio = CONTENT_W / widthPx;
    const heightMm = heightPx * ratio;

    if (heightMm > usableContentHeight) {
      // Pathological oversized leaf: scale down to fit a single page (never cut).
      if (state.currentY > MARGIN_TOP) {
        pdf.addPage();
        state.currentY = MARGIN_TOP;
      }
      const scaledWidth = (CONTENT_W * usableContentHeight) / heightMm;
      const xOffset = MARGIN_X + (CONTENT_W - scaledWidth) / 2;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        xOffset,
        state.currentY,
        scaledWidth,
        usableContentHeight,
        undefined,
        'FAST',
      );
      state.currentY += usableContentHeight;
      return 1;
    }

    const advance = heightMm + LEAF_BLEED_MM;
    ensureNewPageIfNeeded(advance);
    placeCanvas(canvas, heightMm);
    state.currentY += LEAF_BLEED_MM;
    return 1;
  };

  // Walk a node: if it contains marked subsections, descend into direct
  // children — capturing non-subsection children as their own leaves so
  // headers/stats/separators remain in the output. Otherwise capture whole.
  const renderNode = async (node: HTMLElement, depth = 0): Promise<number> => {
    if (!node.offsetWidth || !node.offsetHeight) return 0;

    if (depth >= 8 || !containsSubsections(node)) {
      return renderLeaf(node);
    }

    const children = Array.from(node.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );

    let renderedLeaves = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.offsetWidth || !child.offsetHeight) continue;
      if (containsSubsections(child) || child.hasAttribute('data-pdf-subsection')) {
        renderedLeaves += await renderNode(child, depth + 1);
      } else {
        renderedLeaves += await renderLeaf(child);
      }
      if (i < children.length - 1) state.currentY += SUBSECTION_GAP;
    }

    return renderedLeaves;
  };


  for (const section of sections) {
    const renderedLeaves = await renderNode(section);
    if (renderedLeaves === 0) {
      throw new Error(`A seção "${describePdfNode(section)}" não foi renderizada no PDF`);
    }
    state.currentY += SECTION_GAP;
  }

  // Draw footer on every page
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    drawFooter(pdf, p, totalPages);
  }

  return pdf.output('blob');
}



async function buildPdfFile(url: string, fileName: string): Promise<File> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  // Use a width close to the report's max-w-2xl (672px) + padding so html2canvas
  // captures the mobile-first layout the report was designed for.
  iframe.style.width = '760px';
  iframe.style.height = '800px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.setAttribute('aria-hidden', 'true');

  document.body.appendChild(iframe);
  iframe.src = url;

  try {
    await waitForIframeReady(iframe);
    const doc = iframe.contentDocument!;
    const fullHeight = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
      800,
    );
    iframe.style.height = `${fullHeight}px`;
    await new Promise((r) => setTimeout(r, 400));

    const blob = await generatePdfBlobFromIframe(iframe);
    return new File([blob], fileName, { type: 'application/pdf' });
  } finally {
    iframe.remove();
  }
}

function isRetryablePdfError(err: unknown) {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('não terminou de carregar') ||
    message.includes('tempo esgotado ao preparar relatório') ||
    message.includes('a seção') ||
    message.includes('as mídias do relatório') ||
    message.includes('indisponível para gerar pdf') ||
    message.includes('pdf generation timeout')
  );
}

async function buildPdfFileWithRetry(url: string, fileName: string): Promise<File> {
  const delays = [0, 1200, 2500, 4000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }

    try {
      return await Promise.race([
        buildPdfFile(url, fileName),
        new Promise<File>((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation timeout')), 35000),
        ),
      ]);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Falha ao gerar o PDF do relatório');
      if (!isRetryablePdfError(err) || attempt === delays.length - 1) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Falha ao gerar o PDF do relatório');
}

function downloadFile(file: File) {
  const objUrl = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
}

function isShareSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function isLinkShareSupported(title: string, text: string, url: string) {
  if (!isShareSupported()) return false;
  const payload: ShareData = { title, text, url };
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (typeof nav.canShare !== 'function') return true;
  try {
    return nav.canShare(payload);
  } catch {
    return true;
  }
}

function isUserCancelledShare(err: unknown) {
  const error = err as Error | undefined;
  const name = error?.name || '';
  const message = (error?.message || '').toLowerCase();
  return name === 'AbortError' && (
    message.includes('cancel') ||
    message.includes('canceled') ||
    message.includes('cancelled') ||
    message.includes('aborted')
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share a report URL together with a generated PDF snapshot of the same URL.
 * Falls back to link-only share, then to PDF download + clipboard copy.
 */
export async function shareReportWithPdf(args: ShareReportArgs): Promise<ShareReportResult> {
  const { title, text, fileName, onPdfReady, onPdfFailed } = args;
  const url = new URL(args.url, window.location.href).toString();
  console.log('[shareReportWithPdf] start', { url, fileName });

  const sameOrigin = new URL(url).origin === window.location.origin;
  const canShareLink = isLinkShareSupported(title, text, url);

  if (canShareLink) {
    try {
      console.log('[shareReportWithPdf] attempting native share with link only');
      await navigator.share({ title, text, url });
      if (sameOrigin) {
        void buildPdfFileWithRetry(url, fileName)
          .then(async (file) => {
            console.log('[shareReportWithPdf] PDF generated in background', file.size, 'bytes');
            downloadFile(file);
            onPdfReady?.({ file, action: 'downloaded' });
          })
          .catch((err) => {
            console.warn('[shareReportWithPdf] Background PDF generation failed', err);
            onPdfFailed?.(err instanceof Error ? err : new Error('Falha ao gerar o PDF do relatório'));
          });
      } else {
        console.warn('[shareReportWithPdf] Skipping PDF generation for cross-origin URL', url);
      }
      return { outcome: 'shared-link-only', pdfGenerated: false, pdfStatus: sameOrigin ? 'pending' : 'skipped' };
    } catch (err) {
      if (isUserCancelledShare(err)) {
        return { outcome: 'shared-link-only', pdfGenerated: false, pdfStatus: sameOrigin ? 'pending' : 'skipped' };
      }
      console.warn('[shareReportWithPdf] Native link share failed, using fallback', err);
    }
  }

  console.log('[shareReportWithPdf] using clipboard fallback for link');
  const copiedToClipboard = await copyToClipboard(url);
  if (sameOrigin) {
    void buildPdfFileWithRetry(url, fileName)
      .then((file) => {
        console.log('[shareReportWithPdf] PDF generated in background', file.size, 'bytes');
        downloadFile(file);
        onPdfReady?.({ file, action: 'downloaded' });
      })
      .catch((err) => {
        console.warn('[shareReportWithPdf] Background PDF generation failed', err);
        onPdfFailed?.(err instanceof Error ? err : new Error('Falha ao gerar o PDF do relatório'));
      });
  } else {
    console.warn('[shareReportWithPdf] Skipping PDF generation for cross-origin URL', url);
  }

  return {
    outcome: 'copied',
    copiedToClipboard,
    pdfGenerated: false,
    pdfStatus: sameOrigin ? 'pending' : 'skipped',
  };
}
