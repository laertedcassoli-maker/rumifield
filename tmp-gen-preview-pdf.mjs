import { chromium } from 'playwright';
import fs from 'fs';

const TOKEN = process.env.REPORT_TOKEN || '8bf90180-10ca-43af-9c51-f3984b3d20d5';
const KIND = process.env.REPORT_KIND || 'corretivo'; // 'corretivo' | 'preventivo'
const TYPE = process.env.REPORT_TYPE || 'interno';
const path = KIND === 'corretivo' ? `relatorio-corretivo/${TOKEN}/${TYPE}` : `relatorio/${TOKEN}/${TYPE}`;
const URL = `https://rumifield.lovable.app/${path}?__lovable_token=${process.env.LOVABLE_TOKEN || ''}`;
const OUT = process.env.OUT || `/mnt/documents/relatorio-${KIND}-modelo-v5.pdf`;

const browser = await chromium.launch({ headless: true, executablePath: '/bin/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 760, height: 1200 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('[data-report-ready="true"]', { timeout: 45000 });
await page.waitForTimeout(1500);
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js' });
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' });
const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 760, height: Math.min(fullH, 30000) });
await page.waitForTimeout(500);

const base64 = await page.evaluate(async () => {
  const A4_W = 210, A4_H = 297, MARGIN_X = 10, MARGIN_TOP = 14, MARGIN_BOTTOM = 14;
  const CONTENT_W = A4_W - MARGIN_X * 2;
  const CONTENT_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM;
  const PAGE_SAFE_PADDING = 6;
  const usableContentHeight = CONTENT_H - PAGE_SAFE_PADDING;
  const SECTION_GAP = 3, SUBSECTION_GAP = 2, SCALE = 2;

  window.__PDF_CAPTURE__ = true;
  window.dispatchEvent(new Event('report-pdf-mode'));
  await new Promise((r) => setTimeout(r, 800));

  const { jsPDF } = window.jspdf;
  const h2c = window.html2canvas;
  const root = document.querySelector('[data-pdf-root]') || document.body;
  const sections = Array.from(root.querySelectorAll('[data-pdf-section]'))
    .filter((n) => n.getAttribute('data-pdf-section') !== 'footer');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const state = { currentY: MARGIN_TOP };

  const capture = (el) => h2c(el, {
    useCORS: true, allowTaint: false, backgroundColor: '#ffffff', scale: SCALE,
    imageTimeout: 15000, logging: false,
    windowWidth: el.ownerDocument.documentElement.clientWidth,
  });
  const containsSub = (n) => !!n.querySelector('[data-pdf-subsection]');
  const ensure = (need) => {
    const rem = A4_H - MARGIN_BOTTOM - state.currentY - PAGE_SAFE_PADDING;
    if (need > rem && state.currentY > MARGIN_TOP) { pdf.addPage(); state.currentY = MARGIN_TOP; }
  };
  const place = (c, hmm) => {
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_X, state.currentY, CONTENT_W, hmm, undefined, 'FAST');
    state.currentY += hmm;
  };
  const renderLeaf = async (node) => {
    if (!node.offsetWidth || !node.offsetHeight) return;
    const canvas = await capture(node);
    const widthPx = canvas.width / SCALE;
    const heightPx = canvas.height / SCALE;
    const ratio = CONTENT_W / widthPx;
    const heightMm = heightPx * ratio;
    if (heightMm > usableContentHeight) {
      if (state.currentY > MARGIN_TOP) { pdf.addPage(); state.currentY = MARGIN_TOP; }
      const sw = (CONTENT_W * usableContentHeight) / heightMm;
      const xo = MARGIN_X + (CONTENT_W - sw) / 2;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', xo, state.currentY, sw, usableContentHeight, undefined, 'FAST');
      state.currentY += usableContentHeight;
      return;
    }
    ensure(heightMm);
    place(canvas, heightMm);
  };
  const renderNode = async (node, depth = 0) => {
    if (!node.offsetWidth || !node.offsetHeight) return;
    if (depth >= 8 || !containsSub(node)) return renderLeaf(node);
    const children = Array.from(node.children).filter((c) => c instanceof HTMLElement);
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (!c.offsetWidth || !c.offsetHeight) continue;
      if (containsSub(c) || c.hasAttribute('data-pdf-subsection')) await renderNode(c, depth + 1);
      else await renderLeaf(c);
      if (i < children.length - 1) state.currentY += SUBSECTION_GAP;
    }
  };
  for (const s of sections) { await renderNode(s); state.currentY += SECTION_GAP; }

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(140,140,140);
    pdf.text(`© RumiField ${new Date().getFullYear()}`, MARGIN_X, A4_H - 6);
    const t = `Página ${p} de ${total}`;
    pdf.text(t, A4_W - MARGIN_X - pdf.getTextWidth(t), A4_H - 6);
  }
  const blob = pdf.output('blob');
  const buf = await blob.arrayBuffer();
  let bin = ''; const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
});
fs.writeFileSync(OUT, Buffer.from(base64, 'base64'));
console.log('OK', OUT, fs.statSync(OUT).size);
await browser.close();
