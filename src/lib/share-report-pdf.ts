import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface ShareReportArgs {
  url: string;
  title: string;
  text: string;
  fileName: string;
}

export interface ShareReportResult {
  /** 'shared-with-file' | 'shared-link-only' | 'downloaded' | 'copied' */
  outcome: 'shared-with-file' | 'shared-link-only' | 'downloaded' | 'copied';
  copiedToClipboard?: boolean;
  pdfGenerated?: boolean;
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
const SUBSECTION_GAP = 2;
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
    } catch {}
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
  } catch {}

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
    // @ts-ignore
    if (doc.fonts?.ready) await Promise.race([doc.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  } catch {}

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
  return await html2canvas(section, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    scale: H2C_SCALE,
    imageTimeout: 15000,
    logging: false,
    windowWidth: section.ownerDocument.documentElement.clientWidth,
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

async function generatePdfBlobFromIframe(iframe: HTMLIFrameElement): Promise<Blob> {
  const doc = iframe.contentDocument;
  if (!doc || !doc.body) throw new Error('Conteúdo do relatório indisponível');

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

  // Render a node: prefer atomic subsections so page breaks fall on safe gaps.
  // Only rasterize the whole node when it has no further subsections.
  const renderNode = async (node: HTMLElement, depth = 0): Promise<void> => {
    if (!node.offsetWidth || !node.offsetHeight) return;

    const subs = findFirstLevelSubsections(node);

    // If there are deeper subsections, render them one-by-one with safe breaks.
    if (subs.length > 0 && depth < 6) {
      for (let i = 0; i < subs.length; i++) {
        await renderNode(subs[i], depth + 1);
        if (i < subs.length - 1) state.currentY += SUBSECTION_GAP;
      }
      return;
    }

    // Leaf: capture the whole node.
    let canvas: HTMLCanvasElement;
    try {
      canvas = await captureSection(node);
    } catch (err) {
      console.warn('[pdf] leaf capture failed', err);
      return;
    }
    const widthPx = canvas.width / H2C_SCALE;
    const heightPx = canvas.height / H2C_SCALE;
    const ratio = CONTENT_W / widthPx;
    let heightMm = heightPx * ratio;

    // If the leaf alone is taller than a full page, scale it down to fit a
    // single page. This is intentionally a degraded mode for pathological
    // content (e.g. a massive note paragraph) — but it never cuts text.
    if (heightMm > usableContentHeight) {
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
      return;
    }

    ensureNewPageIfNeeded(heightMm);
    placeCanvas(canvas, heightMm);
  };

  for (const section of sections) {
    await renderNode(section);
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

function isFileShareSupported(file: File, title: string, text: string, url: string) {
  if (!isShareSupported()) return false;
  const payload: ShareData = { title, text, url, files: [file] } as ShareData;
  // @ts-ignore
  if (typeof navigator.canShare !== 'function') return true;
  try {
    // @ts-ignore
    return navigator.canShare(payload);
  } catch {
    return false;
  }
}

function isLinkShareSupported(title: string, text: string, url: string) {
  if (!isShareSupported()) return false;
  const payload: ShareData = { title, text, url };
  // @ts-ignore
  if (typeof navigator.canShare !== 'function') return true;
  try {
    // @ts-ignore
    return navigator.canShare(payload);
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
  const { title, text, fileName } = args;
  const url = new URL(args.url, window.location.href).toString();
  console.log('[shareReportWithPdf] start', { url, fileName });

  let file: File | null = null;
  const sameOrigin = new URL(url).origin === window.location.origin;

  if (sameOrigin) {
    try {
      // Hard cap on PDF generation so the UI never appears stuck
      file = await Promise.race([
        buildPdfFile(url, fileName),
        new Promise<File>((_, reject) =>
          setTimeout(() => reject(new Error('PDF generation timeout')), 35000),
        ),
      ]);
      console.log('[shareReportWithPdf] PDF generated', file.size, 'bytes');
    } catch (err) {
      console.warn('[shareReportWithPdf] PDF generation failed, falling back to link share', err);
    }
  } else {
    console.warn('[shareReportWithPdf] Skipping PDF generation for cross-origin URL', url);
  }

  const pdfGenerated = !!file;
  const canShareFile = !!file && isFileShareSupported(file, title, text, url);
  const canShareLink = isLinkShareSupported(title, text, url);

  if (canShareFile && file) {
    try {
      console.log('[shareReportWithPdf] attempting native share with file');
      await navigator.share({ title, text, url, files: [file] } as ShareData);
      return { outcome: 'shared-with-file', pdfGenerated };
    } catch (err) {
      if (isUserCancelledShare(err)) {
        return { outcome: 'shared-with-file', pdfGenerated };
      }
      console.warn('[shareReportWithPdf] Native file share failed, using fallback', err);
    }
  }

  if (canShareLink) {
    try {
      console.log('[shareReportWithPdf] attempting native share with link only');
      await navigator.share({ title, text, url });
      if (file) downloadFile(file);
      return { outcome: 'shared-link-only', pdfGenerated };
    } catch (err) {
      if (isUserCancelledShare(err)) {
        return { outcome: 'shared-link-only', pdfGenerated };
      }
      console.warn('[shareReportWithPdf] Native link share failed, using fallback', err);
    }
  }

  console.log('[shareReportWithPdf] using download/clipboard fallback');
  if (file) downloadFile(file);
  const copiedToClipboard = await copyToClipboard(url);
  return {
    outcome: file ? 'downloaded' : 'copied',
    copiedToClipboard,
    pdfGenerated,
  };
}
