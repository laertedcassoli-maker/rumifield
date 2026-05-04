import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface FetchedReport {
  preventive: {
    id: string;
    scheduled_date: string;
    completed_date: string | null;
    public_notes: string | null;
    internal_notes: string | null;
    client: { nome: string; fazenda: string | null; cidade: string | null; estado: string | null };
    route: { route_code: string } | null;
    technician_name: string | null;
    checkin_at: string | null;
  };
  checklist: {
    completed_at: string | null;
    blocks: {
      id: string;
      block_name_snapshot: string;
      items: {
        id: string;
        item_name_snapshot: string;
        status: string | null;
        notes: string | null;
        nonconformities: { id: string; nonconformity_label_snapshot: string }[];
        actions: { id: string; action_label_snapshot: string }[];
      }[];
    }[];
  } | null;
  parts: { id: string; part_name_snapshot: string; part_code_snapshot: string; quantity: number; stock_source: string | null; unit_cost_snapshot: number | null }[];
  media: { id: string; file_path: string; file_name: string; caption: string | null }[];
}

async function fetchReport(token: string): Promise<FetchedReport> {
  const { data: preventive, error } = await supabase
    .from('preventive_maintenance')
    .select(`id, scheduled_date, completed_date, public_notes, internal_notes, client_id, route_id,
      client:clientes(nome, fazenda, cidade, estado)`)
    .eq('public_token', token)
    .maybeSingle();

  if (error) throw error;
  if (!preventive) throw new Error('Relatório não encontrado');

  let route: { route_code: string } | null = null;
  let technicianName: string | null = null;
  let checkinAt: string | null = null;

  if (preventive.route_id) {
    const { data: routeData } = await supabase
      .from('preventive_routes')
      .select('route_code, field_technician_user_id')
      .eq('id', preventive.route_id)
      .single();
    if (routeData) {
      route = { route_code: routeData.route_code };
      if (routeData.field_technician_user_id) {
        const { data: tech } = await supabase
          .from('profiles').select('nome').eq('id', routeData.field_technician_user_id).single();
        technicianName = tech?.nome || null;
      }
      const { data: item } = await supabase
        .from('preventive_route_items')
        .select('checkin_at')
        .eq('route_id', preventive.route_id)
        .eq('client_id', preventive.client_id)
        .maybeSingle();
      checkinAt = item?.checkin_at || null;
    }
  }

  const { data: checklist } = await supabase
    .from('preventive_checklists')
    .select('id, completed_at')
    .eq('preventive_id', preventive.id)
    .maybeSingle();

  let checklistData: FetchedReport['checklist'] = null;
  if (checklist) {
    const { data: blocks } = await supabase
      .from('preventive_checklist_blocks')
      .select('id, block_name_snapshot, order_index')
      .eq('checklist_id', checklist.id)
      .order('order_index');

    const blocksWithItems = await Promise.all((blocks || []).map(async (block) => {
      const { data: items } = await supabase
        .from('preventive_checklist_items')
        .select('id, item_name_snapshot, status, notes, order_index')
        .eq('exec_block_id', block.id)
        .order('order_index');
      const itemsWithDetails = await Promise.all((items || []).map(async (item) => {
        const { data: ncs } = await supabase
          .from('preventive_checklist_item_nonconformities')
          .select('id, nonconformity_label_snapshot').eq('exec_item_id', item.id);
        const { data: actions } = await supabase
          .from('preventive_checklist_item_actions')
          .select('id, action_label_snapshot').eq('exec_item_id', item.id);
        return { ...item, nonconformities: ncs || [], actions: actions || [] };
      }));
      return { id: block.id, block_name_snapshot: block.block_name_snapshot, items: itemsWithDetails };
    }));
    checklistData = { completed_at: checklist.completed_at, blocks: blocksWithItems };
  }

  const { data: parts } = await supabase
    .from('preventive_part_consumption')
    .select('id, part_name_snapshot, part_code_snapshot, quantity, stock_source, unit_cost_snapshot')
    .eq('preventive_id', preventive.id);

  const { data: media } = await supabase
    .from('preventive_visit_media')
    .select('id, file_path, file_name, caption')
    .eq('preventive_id', preventive.id);

  const client = (preventive as any).client || { nome: 'Cliente', fazenda: null, cidade: null, estado: null };

  return {
    preventive: {
      id: preventive.id,
      scheduled_date: preventive.scheduled_date,
      completed_date: preventive.completed_date,
      public_notes: preventive.public_notes,
      internal_notes: preventive.internal_notes,
      client,
      route,
      technician_name: technicianName,
      checkin_at: checkinAt,
    },
    checklist: checklistData,
    parts: parts || [],
    media: media || [],
  };
}

async function fetchImageAsDataUrl(path: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const { data } = await supabase.storage.from('preventive-media').createSignedUrl(path, 600);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.75), w, h };
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = { S: 'OK', N: 'Falha', NA: 'N/A' };

export async function generatePreventivePdf(token: string, isInternal: boolean): Promise<{ blob: Blob; filename: string }> {
  const report = await fetchReport(token);
  const { preventive, checklist, parts, media } = report;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFillColor(20, 30, 80);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Visita Preventiva', margin, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(isInternal ? 'Versão Interna' : 'Versão para o Produtor', margin, 16);
  y = 28;

  doc.setTextColor(0, 0, 0);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(preventive.client.nome, margin, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (preventive.client.fazenda) { doc.text(preventive.client.fazenda, margin, y); y += 4; }
  const loc = [preventive.client.cidade, preventive.client.estado].filter(Boolean).join(' - ');
  if (loc) { doc.setTextColor(110); doc.text(loc, margin, y); doc.setTextColor(0); y += 4; }
  y += 2;

  const visitDate = preventive.completed_date
    ? format(parseISO(preventive.completed_date), 'dd/MM/yyyy', { locale: ptBR })
    : format(parseISO(preventive.scheduled_date), 'dd/MM/yyyy', { locale: ptBR });
  const infoRows: [string, string][] = [['Data da Visita', visitDate]];
  if (preventive.technician_name) infoRows.push(['Técnico', preventive.technician_name]);
  if (preventive.checkin_at) infoRows.push(['Check-in', format(parseISO(preventive.checkin_at), 'dd/MM HH:mm', { locale: ptBR })]);
  if (checklist?.completed_at) infoRows.push(['Check-out', format(parseISO(checklist.completed_at), 'dd/MM HH:mm', { locale: ptBR })]);
  if (isInternal && preventive.route) infoRows.push(['Rota', preventive.route.route_code]);

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, fillColor: [240, 240, 245] } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (checklist) {
    const allItems = checklist.blocks.flatMap(b => b.items);
    const okN = allItems.filter(i => i.status === 'S').length;
    const failN = allItems.filter(i => i.status === 'N').length;
    const naN = allItems.filter(i => i.status === 'NA').length;

    ensureSpace(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo do Checklist', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`OK: ${okN}    Falhas: ${failN}    N/A: ${naN}`, margin, y);
    y += 6;

    for (const block of checklist.blocks) {
      if (!block.items.length) continue;
      ensureSpace(12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(235, 238, 245);
      doc.rect(margin, y - 3.5, pageWidth - margin * 2, 5.5, 'F');
      doc.text(block.block_name_snapshot, margin + 1.5, y);
      y += 4;

      const rows: any[] = [];
      for (const item of block.items) {
        const ncs = Array.from(new Set(item.nonconformities.map(n => n.nonconformity_label_snapshot).filter(Boolean)));
        const acts = Array.from(new Set(item.actions.map(a => a.action_label_snapshot).filter(Boolean)));
        const detailParts: string[] = [];
        if (ncs.length) detailParts.push('NC: ' + ncs.join('; '));
        if (acts.length) detailParts.push('Ação: ' + acts.join('; '));
        if (isInternal && item.notes) detailParts.push('Obs: ' + item.notes);
        rows.push([
          STATUS_LABEL[item.status || ''] || '-',
          item.item_name_snapshot,
          detailParts.join('\n') || '-',
        ]);
      }

      autoTable(doc, {
        startY: y,
        head: [['', 'Item', 'Detalhes']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 1.5, valign: 'top' },
        headStyles: { fillColor: [20, 30, 80], textColor: 255, fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 60 },
          2: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const v = String(data.cell.raw);
            if (v === 'OK') data.cell.styles.textColor = [0, 130, 0];
            else if (v === 'Falha') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
            else data.cell.styles.textColor = [120, 120, 120];
          }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
  }

  if (parts.length) {
    ensureSpace(15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Peças Utilizadas', margin, y);
    y += 3;
    const partsRows = parts.map(p => {
      const row: (string | number)[] = [
        p.part_code_snapshot || '-',
        p.part_name_snapshot,
        Number(p.quantity),
        p.stock_source === 'tecnico' ? 'Téc.' : p.stock_source === 'fazenda' ? 'Faz.' : '-',
      ];
      if (isInternal) row.push(p.unit_cost_snapshot ? `R$ ${(Number(p.quantity) * p.unit_cost_snapshot).toFixed(2)}` : '-');
      return row;
    });
    const head = ['Código', 'Descrição', 'Qtd', 'Estoque'];
    if (isInternal) head.push('Total');
    autoTable(doc, {
      startY: y + 2,
      head: [head],
      body: partsRows,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      headStyles: { fillColor: [20, 30, 80], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const showInternalNotes = isInternal && preventive.internal_notes;
  if (preventive.public_notes || showInternalNotes) {
    ensureSpace(15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (preventive.public_notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Para o produtor:', margin, y); y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(preventive.public_notes, pageWidth - margin * 2);
      ensureSpace(lines.length * 4);
      doc.text(lines, margin, y); y += lines.length * 4 + 3;
    }
    if (showInternalNotes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Internas:', margin, y); y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(preventive.internal_notes!, pageWidth - margin * 2);
      ensureSpace(lines.length * 4);
      doc.text(lines, margin, y); y += lines.length * 4 + 3;
    }
  }

  if (media.length) {
    ensureSpace(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fotos (${media.length})`, margin, y);
    y += 4;

    const cols = 2;
    const gap = 4;
    const cellW = (pageWidth - margin * 2 - gap * (cols - 1)) / cols;
    let col = 0;
    let rowH = 0;
    let rowStartY = y;

    for (const m of media) {
      const img = await fetchImageAsDataUrl(m.file_path);
      if (!img) continue;
      const ratio = img.h / img.w;
      const imgH = cellW * ratio;
      const captionH = m.caption ? 4 : 0;
      const blockH = imgH + captionH + 2;

      if (col === 0) {
        if (rowStartY + blockH > pageHeight - margin) {
          doc.addPage();
          rowStartY = margin;
        }
        rowH = 0;
      }
      const x = margin + col * (cellW + gap);
      doc.addImage(img.dataUrl, 'JPEG', x, rowStartY, cellW, imgH);
      if (m.caption) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        const cap = doc.splitTextToSize(m.caption, cellW);
        doc.text(cap[0] || '', x, rowStartY + imgH + 3);
      }
      rowH = Math.max(rowH, blockH);
      col++;
      if (col >= cols) {
        col = 0;
        rowStartY += rowH + gap;
      }
    }
    y = rowStartY + rowH + 4;
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`RumiField • Página ${p} de ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  const blob = doc.output('blob');
  const safeName = preventive.client.nome.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
  const dateStr = format(new Date(preventive.completed_date || preventive.scheduled_date), 'yyyy-MM-dd');
  const filename = `Relatorio_${safeName}_${dateStr}${isInternal ? '_interno' : ''}.pdf`;
  return { blob, filename };
}

export async function sharePreventivePdf(opts: { token: string; isInternal: boolean; clientName?: string }): Promise<'shared' | 'downloaded'> {
  const { blob, filename } = await generatePreventivePdf(opts.token, opts.isInternal);
  const file = new File([blob], filename, { type: 'application/pdf' });

  const shareData: ShareData = {
    title: `Relatório - ${opts.clientName || 'Visita Preventiva'}`,
    text: opts.isInternal ? 'Relatório interno da visita preventiva' : 'Relatório da visita preventiva',
    files: [file],
  };

  const canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare(shareData);

  if (canShareFiles) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
