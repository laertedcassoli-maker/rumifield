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

async function waitForIframeReady(iframe: HTMLIFrameElement, timeoutMs = 25000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tempo esgotado ao carregar relatório')), timeoutMs);
    iframe.addEventListener(
      'load',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
    iframe.addEventListener(
      'error',
      () => {
        clearTimeout(timeout);
        reject(new Error('Falha ao carregar relatório'));
      },
      { once: true }
    );
  });

  // Give the SPA inside the iframe time to mount and fetch data
  await new Promise((r) => setTimeout(r, 800));

  let doc: Document | null = null;
  for (let i = 0; i < 20; i++) {
    try {
      doc = iframe.contentDocument;
      if (doc && doc.body && doc.body.children.length > 0) break;
    } catch {
      // cross-origin (shouldn't happen for same-origin)
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!doc) throw new Error('Não foi possível acessar o conteúdo do relatório');

  // Wait for fonts
  try {
    // @ts-ignore
    if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
  } catch {}

  // Wait for images
  const imgs = Array.from(doc.images || []);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          const done = () => res();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          // Safety timeout per image
          setTimeout(done, 8000);
        })
    )
  );

  // Extra settle for React renders / async data (queries, images post-fetch)
  await new Promise((r) => setTimeout(r, 3500));
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
  // Strip hash and ensure absolute URL
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1024px';
  iframe.style.height = '800px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = url;

  document.body.appendChild(iframe);
  try {
    await waitForIframeReady(iframe);
    // After ready, expand iframe to full content height for accurate capture
    const doc = iframe.contentDocument!;
    const fullHeight = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight,
      800
    );
    iframe.style.height = `${fullHeight}px`;
    // Let layout settle after resize
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

/**
 * Share a report URL together with a generated PDF snapshot of the same URL.
 * Falls back to link-only share, then to PDF download + clipboard copy.
 */
export async function shareReportWithPdf(args: ShareReportArgs): Promise<ShareReportResult> {
  const { url, title, text, fileName } = args;

  let file: File | null = null;
  try {
    file = await buildPdfFile(url, fileName);
  } catch (err) {
    // Could not build PDF — fall back to link-only share immediately.
    console.warn('[shareReportWithPdf] PDF generation failed, falling back to link share', err);
  }

  // Try native share with file
  if (file && typeof navigator.share === 'function') {
    const filePayload: ShareData = { title, text, url, files: [file] } as ShareData;
    // @ts-ignore
    const canShareFiles = !navigator.canShare || navigator.canShare(filePayload);
    if (canShareFiles) {
      try {
        await navigator.share(filePayload);
        return { outcome: 'shared-with-file' };
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return { outcome: 'shared-with-file' };
        }
        // continue to fallback
      }
    }
  }

  // Fallback 1: native share with link only (preserves current behavior)
  if (typeof navigator.share === 'function') {
    const linkPayload: ShareData = { title, text, url };
    // @ts-ignore
    const canShare = !navigator.canShare || navigator.canShare(linkPayload);
    if (canShare) {
      try {
        await navigator.share(linkPayload);
        // Also offer the PDF as a download so the user has both
        if (file) downloadFile(file);
        return { outcome: 'shared-link-only' };
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return { outcome: 'shared-link-only' };
        }
      }
    }
  }

  // Fallback 2: download PDF + copy link
  if (file) downloadFile(file);
  try {
    await navigator.clipboard.writeText(url);
    return { outcome: file ? 'downloaded' : 'copied' };
  } catch {
    return { outcome: file ? 'downloaded' : 'copied' };
  }
}
