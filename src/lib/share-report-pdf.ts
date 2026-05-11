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

async function waitForIframeReady(iframe: HTMLIFrameElement, timeoutMs = 60000): Promise<void> {
  const waitStart = Date.now();

  for (let i = 0; i < 240; i++) {
    try {
      const doc = iframe.contentDocument;
      const href = iframe.contentWindow?.location?.href || '';
      const isLoaded = doc?.readyState === 'complete';
      const hasAppContent = !!doc?.body && doc.body.children.length > 0;
      const hasResolvedRoute = href !== 'about:blank';

      if (isLoaded && hasAppContent && hasResolvedRoute) {
        break;
      }
    } catch {}

    if (Date.now() - waitStart > timeoutMs) {
      throw new Error('Tempo esgotado ao carregar relatório');
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  const doc = iframe.contentDocument;
  if (!doc?.body || doc.body.children.length === 0) {
    throw new Error('Não foi possível acessar o conteúdo do relatório');
  }

  const win = iframe.contentWindow as (Window & { __REPORT_READY__?: boolean }) | null;
  const readyDeadline = Date.now() + Math.max(timeoutMs - (Date.now() - waitStart), 15000);

  while (Date.now() < readyDeadline) {
    const readyFlag = !!win?.__REPORT_READY__;
    const loadingNode = doc.querySelector('[data-report-loading="true"]');
    const hasMeaningfulContent = doc.body.scrollHeight > 400 || doc.body.innerText.trim().length > 120;

    if (readyFlag || (!loadingNode && hasMeaningfulContent)) {
      break;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  try {
    // @ts-ignore
    if (doc.fonts?.ready) await doc.fonts.ready;
  } catch {}

  const imgs = Array.from(doc.images || []);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          const done = () => res();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 15000);
        })
    )
  );

  await new Promise((r) => setTimeout(r, 800));
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
  if (new URL(url).origin === window.location.origin) {
    try {
      file = await buildPdfFile(url, fileName);
    } catch (err) {
      console.warn('[shareReportWithPdf] PDF generation failed, falling back to link share', err);
    }
  } else {
    console.warn('[shareReportWithPdf] Skipping PDF generation for cross-origin URL', url);
  }

  if (file && typeof navigator.share === 'function') {
    const filePayload: ShareData = { title, text, url, files: [file] } as ShareData;
    // @ts-ignore
    const canShareFiles = !navigator.canShare || navigator.canShare(filePayload);
    if (canShareFiles) {
      try {
        await navigator.share(filePayload);
        return { outcome: 'shared-with-file' };
      } catch (err) {
        if (isUserCancelledShare(err)) {
          return { outcome: 'shared-with-file' };
        }
        console.warn('[shareReportWithPdf] Native file share failed, using fallback', err);
      }
    }
  }

  if (typeof navigator.share === 'function') {
    const linkPayload: ShareData = { title, text, url };
    // @ts-ignore
    const canShare = !navigator.canShare || navigator.canShare(linkPayload);
    if (canShare) {
      try {
        await navigator.share(linkPayload);
        if (file) downloadFile(file);
        return { outcome: 'shared-link-only' };
      } catch (err) {
        if (isUserCancelledShare(err)) {
          return { outcome: 'shared-link-only' };
        }
        console.warn('[shareReportWithPdf] Native link share failed, using fallback', err);
      }
    }
  }

  if (file) downloadFile(file);
  const copiedToClipboard = await copyToClipboard(url);
  return {
    outcome: file ? 'downloaded' : 'copied',
    copiedToClipboard,
  };
}
