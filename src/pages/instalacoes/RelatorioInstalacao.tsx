import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Loader2, CheckCircle2, XCircle, MinusCircle, MapPin, Calendar, User, Wrench,
  Camera, FileText, AlertTriangle, Lock, Package, Download,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoRumiFlow from '@/assets/logo-rumiflow.png';
import logoRumina from '@/assets/logo-rumina.png';

const sb = supabase as any;

async function loadReport(token: string) {
  const { data: headerRows, error: hErr } = await sb.rpc('get_public_installation_header', { _token: token });
  if (hErr) throw hErr;
  const header = headerRows?.[0];
  if (!header) return null;
  const stageId = header.stage_id as string;

  const { data: stage, error: sErr } = await sb
    .from('installation_stages')
    .select('id, planned_date, planned_date_end, approved_at, observacao_interna, observacao_externa')
    .eq('id', stageId).maybeSingle();
  if (sErr) throw sErr;

  const { data: checklist } = await sb
    .from('installation_checklists')
    .select('id, completed_at')
    .eq('installation_stage_id', stageId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  let blocks: any[] = [];
  if (checklist) {
    const { data: b } = await sb.from('installation_checklist_blocks')
      .select('id, block_name_snapshot, order_index').eq('checklist_id', checklist.id).order('order_index');
    const blockIds = (b || []).map((x: any) => x.id);
    const { data: items } = blockIds.length
      ? await sb.from('installation_checklist_items')
          .select('id, exec_block_id, item_name_snapshot, order_index, status, notes')
          .in('exec_block_id', blockIds).order('order_index')
      : { data: [] };
    const itemIds = (items || []).map((x: any) => x.id);
    const [{ data: ncs }, { data: acts }] = itemIds.length
      ? await Promise.all([
          sb.from('installation_checklist_item_nonconformities').select('exec_item_id, nonconformity_label_snapshot').in('exec_item_id', itemIds),
          sb.from('installation_checklist_item_actions').select('exec_item_id, action_label_snapshot').in('exec_item_id', itemIds),
        ])
      : [{ data: [] }, { data: [] }];
    blocks = (b || []).map((blk: any) => ({
      ...blk,
      items: (items || []).filter((i: any) => i.exec_block_id === blk.id).map((i: any) => ({
        ...i,
        ncs: (ncs || []).filter((n: any) => n.exec_item_id === i.id).map((n: any) => n.nonconformity_label_snapshot),
        acts: (acts || []).filter((a: any) => a.exec_item_id === i.id).map((a: any) => a.action_label_snapshot),
      })),
    }));
  }

  const { data: parts } = await sb.from('installation_part_consumption')
    .select('id, part_code_snapshot, part_name_snapshot, quantity, unit_cost_snapshot, asset_unique_code')
    .eq('installation_stage_id', stageId);

  const { data: media } = await sb.from('installation_visit_media')
    .select('id, file_path, file_name, file_type').eq('stage_id', stageId).order('created_at');
  const mediaWithUrls = await Promise.all((media || []).map(async (m: any) => {
    const { data } = await supabase.storage.from('preventive-media').createSignedUrl(m.file_path, 3600);
    return { ...m, url: data?.signedUrl as string | undefined };
  }));

  return { header, stage, checklist, blocks, parts: parts || [], media: mediaWithUrls };
}

const lines = (t?: string | null) => (t || '').split('\n').filter((l) => l.trim());

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'S') return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (status === 'N') return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export default function RelatorioInstalacao() {
  const { token, type } = useParams<{ token: string; type?: string }>();
  const isInterno = type === 'interno';
  const [zoom, setZoom] = useState<string | null>(null);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['relatorio-instalacao', token],
    queryFn: () => loadReport(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Relatório não encontrado</h1>
        <p className="text-muted-foreground">O link pode estar incorreto ou a instalação ainda não foi concluída.</p>
      </div>
    );
  }

  const { header, stage, checklist, blocks, parts, media } = report;
  const all = blocks.flatMap((b: any) => b.items);
  const ok = all.filter((i: any) => i.status === 'S').length;
  const fail = all.filter((i: any) => i.status === 'N').length;
  const na = all.filter((i: any) => i.status === 'NA').length;
  const visitDate = checklist?.completed_at || stage?.approved_at || stage?.planned_date;
  const fmt = (d?: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }) : '—');
  const totalCost = parts.reduce((acc: number, p: any) => acc + (Number(p.unit_cost_snapshot) || 0) * (Number(p.quantity) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <style>{`@media print { .no-print { display:none !important; } body { background:white !important; } }`}</style>
      <header className="bg-card border-b py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <img src={logoRumiFlow} alt="RumiFlow" className="h-3.5 object-contain" />
            <img src={logoRumina} alt="Rumina" className="h-5 object-contain" />
          </div>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Wrench className="h-5 w-5" />
              <span className="font-bold">Relatório de Instalação</span>
              {isInterno && <Badge variant="outline">Interno</Badge>}
            </div>
            <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-1" /> Baixar PDF
            </Button>
          </div>
          <h1 className="text-xl font-bold">{header.cliente_nome}</h1>
          {header.fazenda && <p className="text-muted-foreground">{header.fazenda}</p>}
          {(header.cidade || header.estado) && (
            <p className="text-muted-foreground/70 text-sm flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />{[header.cidade, header.estado].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data da Instalação</p>
                <p className="font-medium">{fmt(visitDate)}</p>
              </div>
            </div>
            {header.tecnico_nome && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Técnico Responsável</p>
                  <p className="font-medium">{header.tecnico_nome}</p>
                </div>
              </div>
            )}
            {stage?.planned_date && (
              <div className="col-span-2 text-xs text-muted-foreground">
                Período planejado: {fmt(stage.planned_date)}{stage.planned_date_end ? ` – ${fmt(stage.planned_date_end)}` : ''}
              </div>
            )}
          </CardContent>
        </Card>

        {all.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="text-green-700">{ok} OK</Badge>
                <Badge variant="outline" className="text-destructive">{fail} Falha</Badge>
                <Badge variant="outline">{na} N/A</Badge>
              </div>
              {blocks.map((b: any) => (
                <div key={b.id} className="space-y-2">
                  <p className="font-semibold text-sm border-b pb-1">{b.block_name_snapshot}</p>
                  {b.items.map((i: any) => (
                    <div key={i.id} className="text-sm space-y-1">
                      <div className="flex items-start gap-2 min-w-0">
                        <StatusIcon status={i.status} />
                        <span className="min-w-0">{i.item_name_snapshot}</span>
                      </div>
                      {i.ncs.length > 0 && (
                        <p className="pl-6 text-xs text-destructive">Não conformidade: {Array.from(new Set(i.ncs)).join(', ')}</p>
                      )}
                      {i.acts.length > 0 && (
                        <p className="pl-6 text-xs text-muted-foreground">Ação: {Array.from(new Set(i.acts)).join(', ')}</p>
                      )}
                      {i.notes && <p className="pl-6 text-xs text-muted-foreground">Obs: {i.notes}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {parts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Peças utilizadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {parts.map((p: any) => (
                <div key={p.id} className="flex items-start justify-between gap-2 text-sm min-w-0">
                  <div className="min-w-0">
                    <p className="truncate">{p.part_name_snapshot}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.part_code_snapshot}{p.asset_unique_code ? ` · Ativo ${p.asset_unique_code}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p>{p.quantity}x</p>
                    {isInterno && p.unit_cost_snapshot != null && (
                      <p className="text-xs text-muted-foreground">
                        {(Number(p.unit_cost_snapshot) * Number(p.quantity)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isInterno && totalCost > 0 && (
                <p className="text-sm font-semibold text-right border-t pt-2">
                  Total: {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {lines(stage?.observacao_externa).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Observações</CardTitle></CardHeader>
            <CardContent><ul className="space-y-1 text-sm">{lines(stage?.observacao_externa).map((l, i) => <li key={i}>• {l}</li>)}</ul></CardContent>
          </Card>
        )}

        {isInterno && lines(stage?.observacao_interna).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />Observação Interna</CardTitle></CardHeader>
            <CardContent><ul className="space-y-1 text-sm">{lines(stage?.observacao_interna).map((l, i) => <li key={i}>• {l}</li>)}</ul></CardContent>
          </Card>
        )}

        {media.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" />Fotos da Visita ({media.length})</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {media.map((m: any) => m.url && (
                <img key={m.id} src={m.url} alt={m.file_name} className="aspect-square w-full object-cover rounded-lg cursor-pointer" onClick={() => setZoom(m.url)} />
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={!!zoom} onOpenChange={() => setZoom(null)}>
        <DialogContent className="max-w-[95vw] p-2">
          {zoom && <img src={zoom} alt="" className="w-full max-h-[85vh] object-contain rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
