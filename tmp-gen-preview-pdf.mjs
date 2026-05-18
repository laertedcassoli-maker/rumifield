import { chromium } from 'playwright';
import fs from 'fs';

const URL = `https://93d2c41a-b447-4249-ae06-ee5b8fb38914.lovableproject.com/relatorio/f2733b08-f3a9-4c6c-a358-b8e234329cfb?__lovable_token=${process.env.LOVABLE_TOKEN || ''}`;
const OUT = '/mnt/documents/relatorio-preventivo-modelo-v3.pdf';

const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 760, height: 1200 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (msg) => console.log('[page]', msg.type(), msg.text()));
await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('[data-report-ready="true"]', { timeout: 45000 });
await page.waitForTimeout(1500);
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js' });
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' });
const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 760, height: Math.min(fullH, 20000) });
await page.waitForTimeout(500);
const base64 = await page.evaluate(async () => {
  const A4_W = 210, A4_H = 297, MARGIN_X = 10, MARGIN_TOP = 14, MARGIN_BOTTOM = 12;
  const CONTENT_W = A4_W - MARGIN_X * 2;
  const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM;
  const PAGE_SAFE_PADDING = 2;
  const usableContentHeight = CONTENT_H - PAGE_SAFE_PADDING;
  const GAP = 4, SCALE = 2;
  window.__PDF_CAPTURE__ = true;
  window.dispatchEvent(new Event('report-pdf-mode'));
  await new Promise((r) => setTimeout(r, 600));
  const { jsPDF } = window.jspdf;
  const h2c = window.html2canvas;
  const root = document.querySelector('[data-pdf-root]') || document.body;
  const sections = Array.from(root.querySelectorAll('[data-pdf-section]')).filter((node) => node.getAttribute('data-pdf-section') !== 'footer');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let currentY = MARGIN_TOP;

  const captureSection = (section) => h2c(section, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    scale: SCALE,
    foreignObjectRendering: true,
    imageTimeout: 15000,
    logging: false,
    windowWidth: section.ownerDocument.documentElement.clientWidth,
  });

  const findFirstLevelSubsections = (root) => {
    const out = [];
    const walk = (el) => {
      for (const child of Array.from(el.children)) {
        if (child instanceof HTMLElement && child.hasAttribute('data-pdf-subsection')) out.push(child);
        else walk(child);
      }
    };
    walk(root);
    return out;
  };

  const sliceCanvasToPages = (canvas, ratio) => {
    const sliceHeightPxScaled = Math.floor(usableContentHeight / ratio) * SCALE;
    if (currentY > MARGIN_TOP) {
      pdf.addPage();
      currentY = MARGIN_TOP;
    }
    let offsetPx = 0;
    while (offsetPx < canvas.height) {
      const sliceH = Math.min(sliceHeightPxScaled, canvas.height - offsetPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, -offsetPx);
      const sliceHmm = (sliceH / SCALE) * ratio;
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_X, MARGIN_TOP, CONTENT_W, sliceHmm, undefined, 'FAST');
      offsetPx += sliceH;
      if (offsetPx < canvas.height) pdf.addPage();
      else currentY = MARGIN_TOP + sliceHmm + GAP;
    }
  };

  const renderSection = async (section, depth = 0) => {
    if (!section.offsetWidth || !section.offsetHeight) return;
    const canvas = await captureSection(section);
    const widthPx = canvas.width / SCALE;
    const heightPx = canvas.height / SCALE;
    const ratio = CONTENT_W / widthPx;
    const heightMm = heightPx * ratio;

    if (heightMm <= usableContentHeight) {
      const remaining = A4_H - MARGIN_BOTTOM - currentY - PAGE_SAFE_PADDING;
      if (heightMm > remaining && currentY > MARGIN_TOP) {
        pdf.addPage();
        currentY = MARGIN_TOP;
      }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_X, currentY, CONTENT_W, heightMm, undefined, 'FAST');
      currentY += heightMm + GAP;
      return;
    }

    if (depth < 4) {
      const subs = findFirstLevelSubsections(section);
      if (subs.length > 0) {
        for (const sub of subs) await renderSection(sub, depth + 1);
        return;
      }
    }
    sliceCanvasToPages(canvas, ratio);
  };

  for (const section of sections) await renderSection(section);

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`© RumiField ${new Date().getFullYear()}`, MARGIN_X, A4_H - 6);
    const t = `Página ${p} de ${total}`;
    pdf.text(t, A4_W - MARGIN_X - pdf.getTextWidth(t), A4_H - 6);
  }

  const blob = pdf.output('blob');
  const buf = await blob.arrayBuffer();
  let bin = '';
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
});
fs.writeFileSync(OUT, Buffer.from(base64, 'base64'));
console.log('OK', OUT, fs.statSync(OUT).size);
await browser.close();
