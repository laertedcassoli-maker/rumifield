import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://rumifield.lovable.app/relatorio/f2733b08-f3a9-4c6c-a358-b8e234329cfb';
const OUT = '/mnt/documents/relatorio-preventivo-modelo.pdf';

const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 760, height: 1200 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => console.log('[page]', m.type(), m.text()));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Wait for report-ready marker
await page.waitForFunction(() => !!document.querySelector('[data-report-ready="true"]'), { timeout: 30000 });
await page.waitForTimeout(800);

// Inject html2canvas + jsPDF from CDN
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js' });
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' });

// Resize viewport to full page height before capture
const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 760, height: Math.min(fullH, 20000) });
await page.waitForTimeout(500);

const base64 = await page.evaluate(async () => {
  const A4_W = 210, A4_H = 297, MARGIN_X = 10, MARGIN_TOP = 14, MARGIN_BOTTOM = 12;
  const CONTENT_W = A4_W - MARGIN_X * 2;
  const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM;
  const GAP = 4, SCALE = 2;
  const { jsPDF } = window.jspdf;
  const h2c = window.html2canvas;

  // Force CORS on cross-origin images
  const imgs = Array.from(document.images);
  await Promise.all(imgs.map(img => new Promise(res => {
    if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) return res();
    try {
      const u = new URL(img.src, document.baseURI);
      if (u.origin === location.origin) return res();
    } catch { return res(); }
    if (img.crossOrigin === 'anonymous') return res();
    const orig = img.src;
    img.crossOrigin = 'anonymous';
    img.onload = () => res();
    img.onerror = () => res();
    img.src = orig + (orig.includes('?') ? '&' : '?') + '_pdf=1';
    setTimeout(res, 8000);
  })));

  const root = document.querySelector('[data-pdf-root]') || document.body;
  const sections = Array.from(root.querySelectorAll('[data-pdf-section]'));
  const list = sections.length ? sections : [document.body];

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let y = MARGIN_TOP;

  for (const s of list) {
    if (!s.offsetWidth || !s.offsetHeight) continue;
    const canvas = await h2c(s, { useCORS: true, allowTaint: false, backgroundColor: '#fff', scale: SCALE, logging: false, windowWidth: document.documentElement.clientWidth });
    const wPx = canvas.width / SCALE, hPx = canvas.height / SCALE;
    const ratio = CONTENT_W / wPx;
    const hMm = hPx * ratio;

    if (hMm <= CONTENT_H) {
      const remain = A4_H - MARGIN_BOTTOM - y;
      if (hMm > remain && y > MARGIN_TOP) { pdf.addPage(); y = MARGIN_TOP; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_X, y, CONTENT_W, hMm, undefined, 'FAST');
      y += hMm + GAP;
    } else {
      const sliceHmm = CONTENT_H;
      const slicePx = Math.floor(sliceHmm / ratio) * SCALE;
      if (y > MARGIN_TOP) { pdf.addPage(); y = MARGIN_TOP; }
      let off = 0;
      while (off < canvas.height) {
        const sh = Math.min(slicePx, canvas.height - off);
        const c2 = document.createElement('canvas');
        c2.width = canvas.width; c2.height = sh;
        const cx = c2.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, c2.width, c2.height);
        cx.drawImage(canvas, 0, -off);
        const sHmm = (sh / SCALE) * ratio;
        pdf.addImage(c2.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_X, MARGIN_TOP, CONTENT_W, sHmm, undefined, 'FAST');
        off += sh;
        if (off < canvas.height) pdf.addPage();
        else y = MARGIN_TOP + sHmm + GAP;
      }
    }
  }

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
