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

async function waitForIframeReady(iframe: HTMLIFrameElement, timeoutMs = 18000): Promise<void> {
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

  const win = iframe.contentWindow as (Window & { __REPORT_READY__?: boolean }) | null;

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

  // Wait for images (max 6s)
  const imgs = Array.from(doc.images || []);
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((res) => {
            if (img.complete && img.naturalWidth > 0) return res();
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          })
      )
    ),
    new Promise((r) => setTimeout(r, 6000)),
  ]);

  await new Promise((r) => setTimeout(r, 250));
}

async function generatePdfBlobFromIframe(iframe: HTMLIFrameElement): Promise<Blob> {
  const doc = iframe.contentDocument;
  if (!doc || !doc.body) throw new Error('Conteúdo do relatório indisponível');

  const target = doc.body;
  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    scale: 2,
    windowWidth: 1024,
    windowHeight: target.scrollHeight,
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  return pdf.output('blob');
}

async function buildPdfFile(url: string, fileName: string): Promise<File> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1024px';
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
      800
    );
    iframe.style.height = `${fullHeight}px`;
    await new Promise((r) => setTimeout(r, 300));

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

  let file: File | null = null;
  const sameOrigin = new URL(url).origin === window.location.origin;

  if (sameOrigin) {
    try {
      file = await buildPdfFile(url, fileName);
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

  if (file) downloadFile(file);
  const copiedToClipboard = await copyToClipboard(url);
  return {
    outcome: file ? 'downloaded' : 'copied',
    copiedToClipboard,
    pdfGenerated,
  };
}
