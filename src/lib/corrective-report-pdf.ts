import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface FetchedReport {
  corrective: {
    id: string;
    visit_code: string;
    result: string | null;
    checkin_at: string | null;
    checkout_at: string | null;
    public_notes: string | null;
    internal_notes: string | null;
    visit_summary: string | null;
    client: { nome: string; fazenda: string | null; cidade: string | null; estado: string | null };
    ticket: { ticket_code: string; title: string } | null;
    technician_name: string | null;
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
  parts: { id: string; part_name_snapshot: string; part_code_snapshot: string; quantity: number; stock_source: string | null }[];
  media: { id: string; file_path: string; file_name: string; caption: string | null }[];
}

async function fetchReport(token: string): Promise<FetchedReport> {
  // Token may live on either corrective_maintenance OR preventive_maintenance
  // (legacy/checkout writes it on preventive_maintenance with notes "CORR-VISIT-<visitId>")
  let corrective: any = null;

  const { data: cmDirect, error: cmErr } = await supabase
    .from('corrective_maintenance')
    .select('id, visit_id, client_id, checkin_at, checkout_at, notes, public_token')
    .eq('public_token', token)
    .maybeSingle();
  if (cmErr) throw cmErr;
  corrective = cmDirect;

  if (!corrective) {
    const { data: pmRow, error: pmErr } = await supabase
      .from('preventive_maintenance')
      .select('id, client_id, notes, public_token')
      .eq('public_token', token)
      .maybeSingle();
    if (pmErr) throw pmErr;
    if (!pmRow) throw new Error('Relatório não encontrado');

    const visitMatch = (pmRow.notes || '').match(/CORR-VISIT-([0-9a-f-]{36})/i);
    if (!visitMatch) throw new Error('Visita corretiva não encontrada para o relatório');
    const visitId = visitMatch[1];

    const { data: cmByVisit } = await supabase
      .from('corrective_maintenance')
      .select('id, visit_id, client_id, checkin_at, checkout_at, notes, public_token')
      .eq('visit_id', visitId)
      .maybeSingle();

    corrective = cmByVisit || {
      id: pmRow.id,
      visit_id: visitId,
      client_id: pmRow.client_id,
      checkin_at: null,
      checkout_at: null,
      notes: pmRow.notes,
      public_token: token,
    };
  }

  const { data: visitData } = await supabase
    .from('ticket_visits')
    .select('id, visit_code, ticket_id, field_technician_user_id, result, visit_summary, public_notes, internal_notes')
    .eq('id', corrective.visit_id)
    .maybeSingle();

  const { data: clientData } = await supabase
    .from('clientes')
    .select('nome, fazenda, cidade, estado')
    .eq('id', corrective.client_id)
    .maybeSingle();

  const client = clientData || { nome: 'Cliente', fazenda: null, cidade: null, estado: null };

  let ticket: { ticket_code: string; title: string } | null = null;
  if (visitData?.ticket_id) {
    const { data } = await supabase
      .from('technical_tickets')
      .select('ticket_code, title')
      .eq('id', visitData.ticket_id)
      .maybeSingle();
    ticket = data || null;
  }

  let technicianName: string | null = null;
  if (visitData?.field_technician_user_id) {
    const { data: tech } = await supabase
      .from('profiles').select('nome').eq('id', visitData.field_technician_user_id).single();
    technicianName = tech?.nome || null;
  }

  const preventiveId = corrective.id;

  const { data: checklist } = await supabase
    .from('preventive_checklists')
    .select('id, completed_at')
    .eq('preventive_id', preventiveId)
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
    .select('id, part_name_snapshot, part_code_snapshot, quantity, stock_source')
    .eq('preventive_id', preventiveId);

  const { data: media } = await supabase
    .from('preventive_visit_media')
    .select('id, file_path, file_name, caption')
    .eq('preventive_id', preventiveId);

  return {
    corrective: {
      id: corrective.id,
      visit_code: visitData?.visit_code || 'N/A',
      result: visitData?.result || null,
      checkin_at: corrective.checkin_at,
      checkout_at: corrective.checkout_at,
      public_notes: visitData?.public_notes || null,
      internal_notes: visitData?.internal_notes || corrective.notes,
      visit_summary: visitData?.visit_summary || null,
      client,
      ticket,
      technician_name: technicianName,
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
const RESULT_LABEL: Record<string, string> = {
  resolvido: 'Problema resolvido',
  parcial: 'Parcialmente resolvido',
  aguardando_peca: 'Aguardando peça',
};

export async function generateCorrectivePdf(token: string, isInternal: boolean): Promise<{ blob: Blob; filename: string }> {
  const report = await fetchReport(token);
  const { corrective, checklist, parts, media } = report;

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
  doc.text('Relatório de Visita Corretiva', margin, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(isInternal ? 'Versão Interna' : 'Versão para o Produtor', margin, 16);
  y = 28;

  doc.setTextColor(0, 0, 0);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(corrective.client.nome, margin, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (corrective.client.fazenda) { doc.text(corrective.client.fazenda, margin, y); y += 4; }
  const loc = [corrective.client.cidade, corrective.client.estado].filter(Boolean).join(' - ');
  if (loc) { doc.setTextColor(110); doc.text(loc, margin, y); doc.setTextColor(0); y += 4; }
  y += 2;

  const infoRows: [string, string][] = [];
  infoRows.push(['Visita', corrective.visit_code]);
  if (corrective.ticket) infoRows.push(['Chamado', `${corrective.ticket.ticket_code} - ${corrective.ticket.title}`]);
  if (corrective.result) infoRows.push(['Resultado', RESULT_LABEL[corrective.result] || corrective.result]);
  if (corrective.technician_name) infoRows.push(['Técnico', corrective.technician_name]);
  if (corrective.checkin_at) infoRows.push(['Check-in', format(parseISO(corrective.checkin_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })]);
  if (corrective.checkout_at) infoRows.push(['Check-out', format(parseISO(corrective.checkout_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })]);

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, fillColor: [240, 240, 245] } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (corrective.visit_summary) {
    ensureSpace(15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo da Visita', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(corrective.visit_summary, pageWidth - margin * 2);
    ensureSpace(lines.length * 4);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  if (checklist) {
    const allItems = checklist.blocks.flatMap(b => b.items);
    const okN = allItems.filter(i => i.status === 'S').length;
    const failN = allItems.filter(i => i.status === 'N').length;
    const naN = allItems.filter(i => i.status === 'NA').length;

    ensureSpace(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Checklist Executado', margin, y);
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
    const partsRows = parts.map(p => [
      p.part_code_snapshot || '-',
      p.part_name_snapshot,
      Number(p.quantity),
      p.stock_source === 'tecnico' ? 'Téc.' : p.stock_source === 'fazenda' ? 'Faz.' : '-',
    ]);
    autoTable(doc, {
      startY: y + 2,
      head: [['Código', 'Descrição', 'Qtd', 'Estoque']],
      body: partsRows,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.5 },
      headStyles: { fillColor: [20, 30, 80], textColor: 255 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const showInternalNotes = isInternal && corrective.internal_notes;
  if (corrective.public_notes || showInternalNotes) {
    ensureSpace(15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (corrective.public_notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Para o produtor:', margin, y); y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(corrective.public_notes, pageWidth - margin * 2);
      ensureSpace(lines.length * 4);
      doc.text(lines, margin, y); y += lines.length * 4 + 3;
    }
    if (showInternalNotes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Internas:', margin, y); y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(corrective.internal_notes!, pageWidth - margin * 2);
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
  const safeName = corrective.client.nome.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
  const dateStr = format(new Date(corrective.checkout_at || corrective.checkin_at || new Date()), 'yyyy-MM-dd');
  const filename = `Corretiva_${safeName}_${dateStr}${isInternal ? '_interno' : ''}.pdf`;
  return { blob, filename };
}

export async function shareCorrectivePdf(opts: { token: string; isInternal: boolean; clientName?: string }): Promise<'shared' | 'link-copied'> {
  const { blob, filename } = await generateCorrectivePdf(opts.token, opts.isInternal);

  // Upload to public bucket (upsert so regenerating overwrites the same file)
  const objectPath = `corretiva/${opts.token}${opts.isInternal ? '_interno' : ''}.pdf`;
  const { error: upErr } = await supabase.storage
    .from('relatorios-publicos')
    .upload(objectPath, blob, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Falha ao publicar PDF: ${upErr.message}`);

  const { data: pub } = supabase.storage.from('relatorios-publicos').getPublicUrl(objectPath);
  // Cache-bust so destinatários sempre vejam a versão mais recente
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const title = `Relatório - ${opts.clientName || 'Visita Corretiva'}`;
  const text = `${opts.isInternal ? 'Relatório interno' : 'Relatório'} da visita corretiva${opts.clientName ? ' - ' + opts.clientName : ''}:\n${publicUrl}`;

  const hasShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  if (hasShare) {
    try {
      await navigator.share({ title, text, url: publicUrl });
      return 'shared';
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'AbortError') return 'shared';
      // fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(publicUrl);
  } catch {
    // ignore — caller mostra toast com a URL via retorno se quiser
  }
  return 'link-copied';
}
