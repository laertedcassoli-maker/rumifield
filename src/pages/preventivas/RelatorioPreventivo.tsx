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

interface ReportData {
  preventive: {
    id: string;
    scheduled_date: string;
    completed_date: string | null;
    status: string;
    public_notes: string | null;
    internal_notes: string | null;
    public_token: string;
    client: {
      nome: string;
      fazenda: string | null;
      cidade: string | null;
      estado: string | null;
    };
    route: {
      route_code: string;
    } | null;
    technician_name: string | null;
    route_item: {
      checkin_at: string | null;
      checkin_lat: number | null;
      checkin_lon: number | null;
    } | null;
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
    unit_cost_snapshot: number | null;
  }[];
  media: {
    id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    caption: string | null;
  }[];
}

export default function RelatorioPreventivo() {
  const { token, type } = useParams<{ token: string; type?: string }>();
  const { toast } = useToast();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  const isInternal = type === 'interno';

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['preventive-report', token],
    queryFn: async (): Promise<ReportData> => {
      // Fetch preventive maintenance with client info (joined to bypass RLS on clientes)
      const { data: preventive, error: pmError } = await supabase
        .from('preventive_maintenance')
        .select(`
          id,
          scheduled_date,
          completed_date,
          status,
          public_notes,
          internal_notes,
          public_token,
          client_id,
          route_id,
          client:clientes(nome, fazenda, cidade, estado)
        `)
        .eq('public_token', token)
        .maybeSingle();

      if (pmError) throw pmError;
      if (!preventive) throw new Error('Relatório não encontrado');

      // Extract client from join or fallback
      const client = preventive.client || { nome: 'Cliente', fazenda: null, cidade: null, estado: null };

      // Fetch route info
      let route = null;
      let technicianName = null;
      let routeItem = null;

      if (preventive.route_id) {
        const { data: routeData } = await supabase
          .from('preventive_routes')
          .select('route_code, field_technician_user_id')
          .eq('id', preventive.route_id)
          .single();
        
        if (routeData) {
          route = { route_code: routeData.route_code };
          
          // Fetch technician name
          if (routeData.field_technician_user_id) {
            const { data: tech } = await supabase
              .from('profiles')
              .select('nome')
              .eq('id', routeData.field_technician_user_id)
              .single();
            technicianName = tech?.nome || null;
          }

          // Fetch route item for check-in info
          const { data: item } = await supabase
            .from('preventive_route_items')
            .select('checkin_at, checkin_lat, checkin_lon')
            .eq('route_id', preventive.route_id)
            .eq('client_id', preventive.client_id)
            .maybeSingle();
          routeItem = item;
        }
      }

      // Fetch checklist with full structure
      const { data: checklist } = await supabase
        .from('preventive_checklists')
        .select(`
          id,
          status,
          started_at,
          completed_at
        `)
        .eq('preventive_id', preventive.id)
        .maybeSingle();

      let checklistData = null;
      if (checklist) {
        // Fetch blocks
        const { data: blocks } = await supabase
          .from('preventive_checklist_blocks')
          .select('id, block_name_snapshot, order_index')
          .eq('checklist_id', checklist.id)
          .order('order_index');

        if (blocks) {
          const blocksWithItems = await Promise.all(blocks.map(async (block) => {
            const { data: items } = await supabase
              .from('preventive_checklist_items')
              .select('id, item_name_snapshot, status, notes, order_index')
              .eq('exec_block_id', block.id)
              .order('order_index');

            const itemsWithDetails = await Promise.all((items || []).map(async (item) => {
              const { data: nonconformities } = await supabase
                .from('preventive_checklist_item_nonconformities')
                .select('id, nonconformity_label_snapshot')
                .eq('exec_item_id', item.id);

              const { data: actions } = await supabase
                .from('preventive_checklist_item_actions')
                .select('id, action_label_snapshot')
                .eq('exec_item_id', item.id);

              return {
                ...item,
                nonconformities: nonconformities || [],
                actions: actions || []
              };
            }));

            return { ...block, items: itemsWithDetails };
          }));

          checklistData = { ...checklist, blocks: blocksWithItems };
        }
      }

      // Fetch parts consumption
      const { data: parts } = await supabase
        .from('preventive_part_consumption')
        .select('id, part_name_snapshot, part_code_snapshot, quantity, stock_source, unit_cost_snapshot')
        .eq('preventive_id', preventive.id);

      // Fetch media
      const { data: media } = await supabase
        .from('preventive_visit_media')
        .select('id, file_path, file_name, file_type, caption')
        .eq('preventive_id', preventive.id);

      return {
        preventive: {
          id: preventive.id,
          scheduled_date: preventive.scheduled_date,
          completed_date: preventive.completed_date,
          status: preventive.status,
          public_notes: preventive.public_notes,
          internal_notes: preventive.internal_notes,
          public_token: preventive.public_token!,
          client: client || { nome: 'Cliente', fazenda: null, cidade: null, estado: null },
          route,
          technician_name: technicianName,
          route_item: routeItem
        },
        checklist: checklistData,
        parts: parts || [],
        media: media || []
      };
    },
    enabled: !!token,
  });

  // Generate signed URLs for media after data loads
  useEffect(() => {
    if (report?.media?.length) {
      const loadUrls = async () => {
        const urls: Record<string, string> = {};
        for (const m of report.media) {
          const { data: signedUrl } = await supabase.storage
            .from('preventive-media')
            .createSignedUrl(m.file_path, 3600);
          if (signedUrl) urls[m.id] = signedUrl.signedUrl;
        }
        setImageUrls(urls);
      };
      loadUrls();
    }
  }, [report?.media]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Relatório Preventiva - ${report?.preventive.client.nome}`,
          url
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiado!' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Relatório não encontrado</h1>
        <p className="text-muted-foreground">O link pode estar incorreto ou expirado.</p>
      </div>
    );
  }

  const { preventive, checklist, parts, media } = report;
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
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-6 w-6" />
              <span className="font-bold text-lg">Relatório de Visita</span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" />
              Compartilhar
            </Button>
          </div>
          
          <h1 className="text-2xl font-bold">{preventive.client.nome}</h1>
          {preventive.client.fazenda && (
            <p className="text-primary-foreground/80">{preventive.client.fazenda}</p>
          )}
          {(preventive.client.cidade || preventive.client.estado) && (
            <p className="text-primary-foreground/60 text-sm flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {[preventive.client.cidade, preventive.client.estado].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Visit Info Card */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data da Visita</p>
                  <p className="font-medium">
                    {preventive.completed_date 
                      ? format(parseISO(preventive.completed_date), "dd/MM/yyyy", { locale: ptBR })
                      : format(parseISO(preventive.scheduled_date), "dd/MM/yyyy", { locale: ptBR })
                    }
                  </p>
                </div>
              </div>
              
              {/* Sempre mostrar técnico responsável */}
              {preventive.technician_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Técnico Responsável</p>
                    <p className="font-medium">{preventive.technician_name}</p>
                  </div>
                </div>
              )}

              {/* Check-in - mostrar para ambas versões */}
              {preventive.route_item?.checkin_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                    <p className="font-medium">
                      {format(parseISO(preventive.route_item.checkin_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              {/* Check-out (completed_at do checklist) - mostrar para ambas versões */}
              {checklist?.completed_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Check-out</p>
                    <p className="font-medium">
                      {format(parseISO(checklist.completed_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              {isInternal && preventive.route && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rota</p>
                    <p className="font-medium">{preventive.route.route_code}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Checklist Summary */}
        {checklist && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Resumo do Check-list</span>
                <Badge variant={failItems > 0 ? 'destructive' : 'default'} className="font-normal">
                  {failItems > 0 ? `${failItems} pendência(s)` : 'Tudo OK'}
                </Badge>
              </CardTitle>
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

              {/* Show all items for both versions */}
              {checklist.blocks.map(block => {
                if (block.items.length === 0) return null;

                return (
                  <div key={block.id} className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">{block.block_name_snapshot}</h4>
                    {block.items.map(item => (
                      <div key={item.id} className={`p-2 rounded-lg ${item.status === 'N' ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                        <div className="flex items-start gap-2">
                          <StatusIcon status={item.status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.item_name_snapshot}</p>
                            
                            {item.nonconformities.length > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-muted-foreground">Não conformidades:</p>
                                <ul className="text-xs list-disc list-inside text-destructive">
                                  {uniqueByLabel(item.nonconformities, 'nonconformity_label_snapshot').map(nc => (
                                    <li key={nc.id}>{nc.nonconformity_label_snapshot}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {item.actions.length > 0 && (
                              <div className="mt-1">
                                <p className="text-xs text-muted-foreground">Ações corretivas:</p>
                                <ul className="text-xs list-disc list-inside text-green-700">
                                  {uniqueByLabel(item.actions, 'action_label_snapshot').map(a => (
                                    <li key={a.id}>{a.action_label_snapshot}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {isInternal && item.notes && (
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

        {/* Parts Consumed */}
        {parts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Peças Utilizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {parts.map(part => (
                  <div key={part.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{part.part_name_snapshot}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{part.part_code_snapshot}</span>
                        {part.stock_source && (
                          <Badge variant="outline" className="text-xs h-5">
                            {part.stock_source === 'tecnico' ? 'Est. Técnico' : 'Est. Fazenda'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-medium">{part.quantity}x</p>
                      {isInternal && part.unit_cost_snapshot && (
                        <p className="text-xs text-muted-foreground">
                          R$ {(Number(part.quantity) * part.unit_cost_snapshot).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                
                {isInternal && parts.some(p => p.unit_cost_snapshot) && (
                  <>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total em Peças</span>
                      <span>
                        R$ {parts.reduce((acc, p) => acc + (Number(p.quantity) * (p.unit_cost_snapshot || 0)), 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {media.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Fotos ({media.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {media.map(m => (
                  <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    {imageUrls[m.id] ? (
                      <img 
                        src={imageUrls[m.id]} 
                        alt={m.caption || m.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {m.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                        {m.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observations */}
        {(preventive.public_notes || (isInternal && preventive.internal_notes)) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {preventive.public_notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Para o produtor</p>
                  <p className="text-sm whitespace-pre-wrap">{preventive.public_notes}</p>
                </div>
              )}
              
              {isInternal && preventive.internal_notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Observações internas</p>
                  <p className="text-sm whitespace-pre-wrap">{preventive.internal_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground py-6">
          <p>Relatório gerado automaticamente</p>
          <p className="mt-1">© RumiField {new Date().getFullYear()}</p>
        </footer>
      </main>
    </div>
  );
}
