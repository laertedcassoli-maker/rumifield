import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  MapPin,
  Calendar,
  Clock,
  User,
  Wrench,
  Camera,
  FileText,
  Share2,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import logoRumiFlow from '@/assets/logo-rumiflow.png';
import logoRumina from '@/assets/logo-rumina.png';
import { shareReportWithPdf, buildReportFileName } from '@/lib/share-report-pdf';

interface ReportData {
  corrective: {
    id: string;
    visit_code: string;
    status: string;
    result: string | null;
    checkin_at: string | null;
    checkout_at: string | null;
    public_notes: string | null;
    internal_notes: string | null;
    visit_summary: string | null;
    client: {
      nome: string;
      fazenda: string | null;
      cidade: string | null;
      estado: string | null;
    };
    ticket: {
      ticket_code: string;
      title: string;
    } | null;
    technician_name: string | null;
  };
  checklist: {
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    blocks: {
      id: string;
      block_name_snapshot: string;
      order_index: number;
      items: {
        id: string;
        item_name_snapshot: string;
        status: string | null;
        notes: string | null;
        order_index: number;
        nonconformities: {
          id: string;
          nonconformity_label_snapshot: string;
        }[];
        actions: {
          id: string;
          action_label_snapshot: string;
        }[];
      }[];
    }[];
  } | null;
  parts: {
    id: string;
    part_name_snapshot: string;
    part_code_snapshot: string;
    quantity: number;
    stock_source: string | null;
  }[];
  media: {
    id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    caption: string | null;
  }[];
}

export default function RelatorioCorretivo() {
  const { token, type } = useParams<{ token: string; type?: string }>();
  const { toast } = useToast();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [imageLoadAttempted, setImageLoadAttempted] = useState(false);
  const [imageFailedIds, setImageFailedIds] = useState<string[]>([]);
  const [isPdfCapture, setIsPdfCapture] = useState(() => Boolean((window as any).__PDF_CAPTURE__));
  const [isReportReadyForPdf, setIsReportReadyForPdf] = useState(false);
  
  const isInternal = type === 'interno';

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['corrective-report', token],
    queryFn: async (): Promise<ReportData> => {
      // Fetch corrective_maintenance by public_token
      const { data: corrective, error: cmError } = await supabase
        .from('corrective_maintenance')
        .select(`
          id,
          visit_id,
          client_id,
          status,
          checkin_at,
          checkout_at,
          notes,
          public_token
        `)
        .eq('public_token', token)
        .maybeSingle();

      if (cmError) throw cmError;
      if (!corrective) throw new Error('Relatório não encontrado');

      const [visitResponse, clientResponse] = await Promise.all([
        supabase
          .from('ticket_visits')
          .select(`
            id,
            visit_code,
            ticket_id,
            field_technician_user_id,
            result,
            visit_summary,
            public_notes,
            internal_notes
          `)
          .eq('id', corrective.visit_id)
          .maybeSingle(),
        supabase
          .from('clientes')
          .select('nome, fazenda, cidade, estado')
          .eq('id', corrective.client_id)
          .maybeSingle(),
      ]);

      if (visitResponse.error) throw visitResponse.error;
      if (clientResponse.error) throw clientResponse.error;

      const visitData = visitResponse.data;
      const clientData = clientResponse.data;

      const client = clientData || { nome: 'Cliente', fazenda: null, cidade: null, estado: null };

      const [ticketResponse, technicianResponse, linkedPreventiveResponse] = await Promise.all([
        visitData?.ticket_id
          ? supabase
              .from('technical_tickets')
              .select('ticket_code, title')
              .eq('id', visitData.ticket_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        visitData?.field_technician_user_id
          ? supabase
              .from('profiles')
              .select('nome')
              .eq('id', visitData.field_technician_user_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        visitData?.id
          ? supabase
              .from('preventive_maintenance')
              .select('id, public_notes, internal_notes')
              .eq('client_id', corrective.client_id)
              .ilike('notes', `%CORR-VISIT-${visitData.id}%`)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (ticketResponse.error) throw ticketResponse.error;
      if (technicianResponse.error) throw technicianResponse.error;
      if (linkedPreventiveResponse.error) throw linkedPreventiveResponse.error;

      const ticket = ticketResponse.data;
      const technicianName = technicianResponse.data?.nome || null;
      const linkedPreventive = linkedPreventiveResponse.data;

      let checklistData = null;
      let parts: ReportData['parts'] = [];
      let media: ReportData['media'] = [];

      if (linkedPreventive?.id) {
        const [checklistResponse, partsResponse, mediaResponse] = await Promise.all([
          supabase
            .from('preventive_checklists')
            .select('id, status, started_at, completed_at')
            .eq('preventive_id', linkedPreventive.id)
            .maybeSingle(),
          supabase
            .from('preventive_part_consumption')
            .select('id, part_name_snapshot, part_code_snapshot, quantity, stock_source')
            .eq('preventive_id', linkedPreventive.id),
          supabase
            .from('preventive_visit_media')
            .select('id, file_path, file_name, file_type, caption')
            .eq('preventive_id', linkedPreventive.id),
        ]);

        if (checklistResponse.error) throw checklistResponse.error;
        if (partsResponse.error) throw partsResponse.error;
        if (mediaResponse.error) throw mediaResponse.error;

        parts = partsResponse.data || [];
        media = mediaResponse.data || [];

        const checklist = checklistResponse.data;

        if (checklist) {
          const { data: blocks, error: blocksError } = await supabase
            .from('preventive_checklist_blocks')
            .select('id, block_name_snapshot, order_index')
            .eq('checklist_id', checklist.id)
            .order('order_index');

          if (blocksError) throw blocksError;

          if (blocks) {
            const blocksWithItems = await Promise.all(blocks.map(async (block) => {
              const { data: items, error: itemsError } = await supabase
                .from('preventive_checklist_items')
                .select('id, item_name_snapshot, status, notes, order_index')
                .eq('exec_block_id', block.id)
                .order('order_index');

              if (itemsError) throw itemsError;

              const itemsWithDetails = await Promise.all((items || []).map(async (item) => {
                const [nonconformitiesResponse, actionsResponse] = await Promise.all([
                  supabase
                    .from('preventive_checklist_item_nonconformities')
                    .select('id, nonconformity_label_snapshot')
                    .eq('exec_item_id', item.id),
                  supabase
                    .from('preventive_checklist_item_actions')
                    .select('id, action_label_snapshot')
                    .eq('exec_item_id', item.id),
                ]);

                if (nonconformitiesResponse.error) throw nonconformitiesResponse.error;
                if (actionsResponse.error) throw actionsResponse.error;

                return {
                  ...item,
                  nonconformities: nonconformitiesResponse.data || [],
                  actions: actionsResponse.data || []
                };
              }));

              return { ...block, items: itemsWithDetails };
            }));

            checklistData = { ...checklist, blocks: blocksWithItems };
          }
        }
      }

      return {
        corrective: {
          id: corrective.id,
          visit_code: visitData?.visit_code || 'N/A',
          status: corrective.status,
          result: visitData?.result || null,
          checkin_at: corrective.checkin_at,
          checkout_at: corrective.checkout_at,
          public_notes: linkedPreventive?.public_notes || visitData?.public_notes || null,
          internal_notes: linkedPreventive?.internal_notes || visitData?.internal_notes || corrective.notes,
          visit_summary: visitData?.visit_summary || null,
          client,
          ticket,
          technician_name: technicianName
        },
        checklist: checklistData,
        parts: parts || [],
        media: media || []
      };
    },
    enabled: !!token,
  });

  useEffect(() => {
    setImageUrls({});
    setImageFailedIds([]);
    setImageLoadAttempted(false);
  }, [report?.media]);

  // Generate signed URLs for media after data loads
  useEffect(() => {
    if (report?.media?.length && !imageLoadAttempted) {
      const loadUrls = async () => {
        const urls: Record<string, string> = {};
        const failedIds: string[] = [];
        for (const m of report.media) {
          try {
            const { data: signedUrl, error } = await supabase.storage
              .from('preventive-media')
              .createSignedUrl(m.file_path, 3600);
            if (signedUrl && !error) {
              urls[m.id] = signedUrl.signedUrl;
            } else {
              failedIds.push(m.id);
            }
          } catch (e) {
            console.error('Error loading media', m.id, e);
            failedIds.push(m.id);
          }
        }
        setImageUrls(urls);
        setImageFailedIds(failedIds);
        setImageLoadAttempted(true);
      };
      loadUrls();
    } else if (report && report.media.length === 0 && !imageLoadAttempted) {
      setImageFailedIds([]);
      setImageLoadAttempted(true);
    }
  }, [report?.media, imageLoadAttempted]);

  // Signal readiness for PDF capture (used by shareReportWithPdf iframe)
  useEffect(() => {
    (window as any).__REPORT_READY__ = false;
    setIsReportReadyForPdf(false);
    if (isLoading || !report) return;
    const hasMedia = (report.media?.length ?? 0) > 0;
    const resolvedMediaCount = Object.keys(imageUrls).length + imageFailedIds.length;
    if (hasMedia && (!imageLoadAttempted || resolvedMediaCount < report.media.length)) return;

    const requiredSections = [
      'header',
      'visit-info',
      ...(report.corrective.visit_summary ? ['visit-summary'] : []),
      ...(report.checklist ? ['checklist'] : []),
      ...(report.parts.length > 0 ? ['parts'] : []),
      ...(report.media.length > 0 ? ['media'] : []),
      ...(report.corrective.public_notes ? ['public-notes'] : []),
      ...(isInternal && report.corrective.internal_notes ? ['internal-notes'] : []),
    ];

    const t = setTimeout(() => {
      const missingSections = requiredSections.filter((section) => !document.querySelector(`[data-pdf-section="${section}"]`));
      const renderedMediaItems = document.querySelectorAll('[data-report-media-item="true"]').length;
      const readyMediaItems = document.querySelectorAll('[data-report-media-ready="true"]').length;
      const mediaReady = report.media.length === 0 || (renderedMediaItems >= report.media.length && readyMediaItems >= report.media.length);

      if (missingSections.length > 0 || !mediaReady) return;

      setIsReportReadyForPdf(true);
      (window as any).__REPORT_READY__ = true;
      window.dispatchEvent(new Event('report-ready'));
    }, 600);
    return () => clearTimeout(t);
  }, [isLoading, report, imageLoadAttempted, imageUrls, imageFailedIds, isInternal]);

  useEffect(() => {
    const syncPdfMode = () => setIsPdfCapture(Boolean((window as any).__PDF_CAPTURE__));
    syncPdfMode();
    window.addEventListener('report-pdf-mode', syncPdfMode);
    return () => window.removeEventListener('report-pdf-mode', syncPdfMode);
  }, []);

  const [isSharing, setIsSharing] = useState(false);
  const handleShare = async () => {
    const url = window.location.href;
    setIsSharing(true);
    try {
      const result = await shareReportWithPdf({
        url,
        title: `Relatório Corretiva - ${report?.corrective.client.nome}`,
        text: `Confira o relatório: ${url}`,
        fileName: buildReportFileName(report?.corrective.client.nome || 'relatorio-corretivo'),
        onPdfReady: () => {
          toast({ title: 'PDF pronto', description: 'O download do PDF foi iniciado.' });
        },
        onPdfFailed: (error) => {
          toast({ variant: 'destructive', title: 'Link gerado, mas o PDF falhou', description: error.message });
        },
      });
      if (result.cancelled) return;
      if (result.pdfStatus === 'pending') {
        toast({
          title: result.copiedToClipboard ? 'Link copiado!' : 'Link gerado!',
          description: 'O link já está pronto. Aguarde enquanto o PDF termina de ser gerado.',
        });
      } else if (result.outcome === 'copied') {
        toast({ title: 'Link copiado!', description: 'O PDF não será gerado para este link.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao compartilhar', description: (e as Error).message });
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-report-loading="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center" data-report-error="true">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Relatório não encontrado</h1>
        <p className="text-muted-foreground">O link pode estar incorreto ou expirado.</p>
      </div>
    );
  }

  const { corrective, checklist, parts, media } = report;
  const totalItems = checklist?.blocks.reduce((acc, b) => acc + b.items.length, 0) || 0;
  const okItems = checklist?.blocks.reduce((acc, b) => acc + b.items.filter(i => i.status === 'S').length, 0) || 0;
  const failItems = checklist?.blocks.reduce((acc, b) => acc + b.items.filter(i => i.status === 'N').length, 0) || 0;
  const naItems = checklist?.blocks.reduce((acc, b) => acc + b.items.filter(i => i.status === 'NA').length, 0) || 0;

  const StatusIcon = ({ status }: { status: string | null }) => {
    if (status === 'S') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'N') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'NA') return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
    return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getResultBadge = () => {
    const resultLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      resolvido: { label: 'Resolvido', variant: 'default' },
      parcial: { label: 'Parcialmente Resolvido', variant: 'secondary' },
      aguardando_peca: { label: 'Aguardando Peça', variant: 'destructive' }
    };
    const r = corrective.result ? resultLabels[corrective.result] : null;
    if (!r) return null;
    if (isPdfCapture) {
      return <p className="font-medium text-sm break-words">{r.label}</p>;
    }
    return <Badge variant={r.variant}>{r.label}</Badge>;
  };

  const uniqueByLabel = <T extends { [K in L]: string }, L extends keyof any>(
    items: T[],
    labelKey: L
  ) => {
    const map = new Map<string, T>();
    for (const it of items) {
      const label = String((it as any)[labelKey] ?? '').trim();
      if (!label) continue;
      if (!map.has(label)) map.set(label, it);
    }
    return Array.from(map.values());
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background" data-pdf-root="true" data-pdf-capture={isPdfCapture ? 'true' : 'false'}>
      {/* Header */}
      <header className="bg-white border-b py-4 px-4" data-pdf-section="header">
        <div className="max-w-2xl mx-auto">
          {/* Logos */}
          <div className="flex items-center justify-between mb-3">
            <img src={logoRumiFlow} alt="RumiFlow" className="h-3.5 object-contain" />
            <img src={logoRumina} alt="Rumina" className="h-5 object-contain" />
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-orange-600">
              <Wrench className="h-5 w-5" />
              <span className="font-bold">Relatório de Visita Corretiva</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleShare} disabled={isSharing} data-pdf-hide="true">
              {isSharing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}
              Compartilhar
            </Button>
          </div>
          
          <h1 className="text-xl font-bold text-foreground">{corrective.client.nome}</h1>
          {corrective.client.fazenda && (
            <p className="text-muted-foreground">{corrective.client.fazenda}</p>
          )}
          {(corrective.client.cidade || corrective.client.estado) && (
            <p className="text-muted-foreground/70 text-sm flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {[corrective.client.cidade, corrective.client.estado].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>
      </header>

      <main
        className="max-w-2xl mx-auto p-4 space-y-4"
        data-report-ready={isReportReadyForPdf ? 'true' : 'false'}
        data-report-media-count={media.length}
      >
        {/* Visit Info Card */}
        <Card data-pdf-section="visit-info">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Visit Code */}
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Visita</p>
                  <p className="font-medium">{corrective.visit_code}</p>
                </div>
              </div>

              {/* Result */}
              {corrective.result && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Resultado</p>
                    {getResultBadge()}
                  </div>
                </div>
              )}

              {/* Technician */}
              {corrective.technician_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Técnico Responsável</p>
                    <p className="font-medium">{corrective.technician_name}</p>
                  </div>
                </div>
              )}

              {/* Check-in */}
              {corrective.checkin_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">
                      {format(parseISO(corrective.checkin_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              {/* Check-out */}
              {corrective.checkout_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">
                      {format(parseISO(corrective.checkout_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              {/* Linked Ticket */}
              {isInternal && corrective.ticket && (
                <div className="flex items-center gap-2 col-span-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Chamado Vinculado</p>
                    <p className="font-medium">{corrective.ticket.ticket_code} - {corrective.ticket.title}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visit Summary */}
        {corrective.visit_summary && (
          <Card data-pdf-section="visit-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumo da Visita</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{corrective.visit_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Checklist Summary */}
        {checklist && (
          <Card data-pdf-section="checklist">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Check-list de Verificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{okItems} OK</span>
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{failItems} Falhas</span>
                </span>
                <span className="flex items-center gap-1">
                  <MinusCircle className="h-4 w-4 text-muted-foreground" />
                  <span>{naItems} N/A</span>
                </span>
              </div>

              <Separator />

              {checklist.blocks.map(block => {
                if (block.items.length === 0) return null;

                return (
                  <div key={block.id} className="space-y-2" data-pdf-subsection="checklist-block">
                    <h4 data-pdf-subsection="checklist-block-title" className="font-medium text-sm text-muted-foreground">{block.block_name_snapshot}</h4>
                    {block.items.map(item => (
                      <div key={item.id} data-pdf-subsection="checklist-item" className={`p-2 rounded-lg ${item.status === 'N' ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                        <div className="flex items-start gap-2">
                          <StatusIcon status={item.status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.item_name_snapshot}</p>
                            
                            {item.nonconformities.length > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-muted-foreground">Não conformidades:</p>
                                {isPdfCapture ? (
                                  <p className="text-xs text-destructive break-words">
                                    {uniqueByLabel(item.nonconformities, 'nonconformity_label_snapshot')
                                      .map(nc => nc.nonconformity_label_snapshot).join(' • ')}
                                  </p>
                                ) : (
                                  uniqueByLabel(item.nonconformities, 'nonconformity_label_snapshot').map(nc => (
                                    <Badge key={nc.id} variant="outline" className="mr-1 mt-1 text-xs border-destructive text-destructive">
                                      {nc.nonconformity_label_snapshot}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            )}
                            
                            {item.actions.length > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-muted-foreground">Ações corretivas:</p>
                                {isPdfCapture ? (
                                  <p className="text-xs text-green-700 break-words">
                                    {uniqueByLabel(item.actions, 'action_label_snapshot')
                                      .map(a => a.action_label_snapshot).join(' • ')}
                                  </p>
                                ) : (
                                  uniqueByLabel(item.actions, 'action_label_snapshot').map(action => (
                                    <Badge key={action.id} variant="outline" className="mr-1 mt-1 text-xs border-green-600 text-green-600">
                                      {action.action_label_snapshot}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            )}

                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">"{item.notes}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Parts Consumption */}
        {parts.length > 0 && (
          <Card data-pdf-section="parts">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Peças Utilizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {parts.map(part => (
                  <div key={part.id} data-pdf-subsection="part-item" className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{part.part_name_snapshot}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{part.part_code_snapshot}</span>
                        {isInternal && part.stock_source && (
                          isPdfCapture ? (
                            <span>• {part.stock_source === 'tecnico' ? 'Técnico' : 'Fazenda'}</span>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {part.stock_source === 'tecnico' ? 'Técnico' : 'Fazenda'}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{part.quantity}x</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Media Gallery */}
        {media.length > 0 && (
          <Card data-pdf-section="media">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos e Vídeos ({media.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const renderItem = (m: typeof media[number]) => (
                  <div
                    key={m.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                    data-report-media-item="true"
                    data-report-media-ready={imageUrls[m.id] || imageFailedIds.includes(m.id) ? 'true' : 'false'}
                  >
                    {m.file_type.startsWith('image/') ? (
                      imageUrls[m.id] ? (
                        <img
                          src={imageUrls[m.id]}
                          alt={m.caption || m.file_name}
                          crossOrigin={isPdfCapture ? 'anonymous' : undefined}
                          loading={isPdfCapture ? 'eager' : 'lazy'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          Indisponível
                        </div>
                      )
                    ) : (
                      imageUrls[m.id] ? (
                        <video src={imageUrls[m.id]} controls className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          Vídeo indisponível
                        </div>
                      )
                    )}
                    {m.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                        <p className="text-white text-xs truncate">{m.caption}</p>
                      </div>
                    )}
                  </div>
                );

                if (isPdfCapture) {
                  const rows: typeof media[] = [];
                  for (let i = 0; i < media.length; i += 2) rows.push(media.slice(i, i + 2));
                  return (
                    <div className="space-y-2">
                      {rows.map((row, idx) => (
                        <div key={idx} data-pdf-subsection="media-row" className="grid grid-cols-2 gap-2">
                          {row.map(renderItem)}
                          {row.length === 1 && <div />}
                        </div>
                      ))}
                    </div>
                  );
                }

                return <div className="grid grid-cols-2 gap-2">{media.map(renderItem)}</div>;
              })()}
            </CardContent>

          </Card>
        )}

        {/* Public Notes */}
        {corrective.public_notes && (
          <Card data-pdf-section="public-notes">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{corrective.public_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Internal Notes (only for internal view) */}
        {isInternal && corrective.internal_notes && (
          <Card data-pdf-section="internal-notes" className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground">Observações Internas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{corrective.internal_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-xs text-muted-foreground" data-pdf-section="footer" data-pdf-hide="true">
          <p>Relatório gerado automaticamente pelo sistema RumiField</p>
          <p className="mt-1">© {new Date().getFullYear()} Rumina Tecnologia</p>
        </div>
      </main>
    </div>
  );
}
