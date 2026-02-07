import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { offlineDb } from '@/lib/offline-db';
import { PRODUCT_LABELS, type ProductCode } from '@/hooks/useCrmData';
import { ProductBadge } from '@/components/crm/ProductBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, FileAudio, Type, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  visitId: string;
}

interface AudioItem {
  id: string;
  product_code: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  transcription: string | null;
  summary: string[] | null;
  status: string;
  created_at: string;
  // only in local
  audioData?: Uint8Array;
  source: 'local' | 'remote';
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VisitAudioList({ visitId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'transcribe' | 'summarize' | null>(null);

  // Local audios from IndexedDB
  const localAudios = useLiveQuery(
    () => offlineDb.crm_visit_audios.where('visit_id').equals(visitId).toArray(),
    [visitId],
    []
  );

  // Remote audios from Supabase
  const { data: remoteAudios, refetch: refetchRemote } = useQuery({
    queryKey: ['crm-visit-audios', visitId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_visit_audios')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!visitId,
  });

  // Merge local + remote, deduplicating by id
  const audioItems: AudioItem[] = (() => {
    const remoteIds = new Set((remoteAudios || []).map((a: any) => a.id));
    const items: AudioItem[] = [];

    // Local items not yet in remote
    for (const la of localAudios || []) {
      if (!remoteIds.has(la.id)) {
        items.push({
          id: la.id,
          product_code: la.product_code,
          duration_seconds: la.duration_seconds,
          file_size_bytes: la.file_size_bytes,
          transcription: null,
          summary: null,
          status: la.status,
          created_at: la.created_at,
          audioData: la.audioData,
          source: 'local',
        });
      }
    }

    // Remote items (may have transcription/summary)
    for (const ra of remoteAudios || []) {
      // Check if we also have the local blob
      const localMatch = (localAudios || []).find(l => l.id === ra.id);
      items.push({
        id: ra.id,
        product_code: ra.product_code,
        duration_seconds: ra.duration_seconds,
        file_size_bytes: ra.file_size_bytes,
        transcription: ra.transcription,
        summary: ra.summary,
        status: ra.status,
        created_at: ra.created_at,
        audioData: localMatch?.audioData,
        source: 'remote',
      });
    }

    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return items;
  })();

  const handleTranscribe = useCallback(async (item: AudioItem) => {
    if (!item.audioData) {
      toast({ variant: 'destructive', title: 'Áudio não disponível localmente' });
      return;
    }

    setProcessingId(item.id);
    setProcessingAction('transcribe');

    try {
      // 1. Convert to base64 and call transcribe FIRST (before upload to avoid timeout)
      const base64 = btoa(
        item.audioData.reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data: fnData, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64, mode: 'transcribe', skipClientMatch: true },
      });
      if (fnError) throw fnError;

      const transcription = fnData?.transcription || '';

      // 2. Upload to storage (background, non-blocking for UX)
      const storagePath = `${user!.id}/${item.id}.webm`;
      const blob = new Blob([item.audioData.slice().buffer as ArrayBuffer], { type: 'audio/webm' });
      supabase.storage
        .from('crm-visit-audios')
        .upload(storagePath, blob, { contentType: 'audio/webm', upsert: true })
        .then(({ error }) => { if (error) console.warn('Storage upload failed (non-critical):', error); });

      // 3. Upsert record in DB with transcription
      const { error: upsertError } = await (supabase as any)
        .from('crm_visit_audios')
        .upsert({
          id: item.id,
          visit_id: visitId,
          product_code: item.product_code,
          user_id: user!.id,
          storage_path: storagePath,
          file_size_bytes: item.file_size_bytes,
          duration_seconds: item.duration_seconds,
          transcription,
          status: 'transcribed',
          created_at: item.created_at,
        });
      if (upsertError) throw upsertError;

      // 4. Remove local blob
      await offlineDb.crm_visit_audios.delete(item.id);

      refetchRemote();
      toast({ title: 'Transcrição concluída!' });
    } catch (err: any) {
      console.error('Transcription error:', err);
      toast({ variant: 'destructive', title: 'Erro na transcrição', description: err.message });
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  }, [user, visitId, refetchRemote, toast]);

  const handleSummarize = useCallback(async (item: AudioItem) => {
    if (!item.transcription) return;

    setProcessingId(item.id);
    setProcessingAction('summarize');

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
        body: { text: item.transcription, mode: 'summarize' },
      });
      if (fnError) throw fnError;

      const summary = fnData?.summary || [];

      const { error: updateError } = await (supabase as any)
        .from('crm_visit_audios')
        .update({ summary, status: 'summarized' })
        .eq('id', item.id);
      if (updateError) throw updateError;

      refetchRemote();
      toast({ title: 'Resumo gerado!' });
    } catch (err: any) {
      console.error('Summarize error:', err);
      toast({ variant: 'destructive', title: 'Erro ao resumir', description: err.message });
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  }, [refetchRemote, toast]);

  const handleDelete = useCallback(async (item: AudioItem) => {
    try {
      // Delete local
      await offlineDb.crm_visit_audios.delete(item.id);

      // Delete remote if exists
      if (item.source === 'remote') {
        await (supabase as any).from('crm_visit_audios').delete().eq('id', item.id);
        // Delete from storage if path exists
        const remote = (remoteAudios || []).find((r: any) => r.id === item.id);
        if (remote?.storage_path) {
          await supabase.storage.from('crm-visit-audios').remove([remote.storage_path]);
        }
        refetchRemote();
      }

      toast({ title: 'Áudio apagado' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: err.message });
    }
  }, [remoteAudios, refetchRemote, toast]);

  if (audioItems.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <FileAudio className="h-5 w-5" /> Áudios da Visita
      </h2>
      <div className="space-y-2">
        {audioItems.map(item => {
          const isProcessing = processingId === item.id;
          return (
            <Card key={item.id}>
              <CardContent className="py-3 space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ProductBadge productCode={item.product_code as ProductCode} className="text-xs px-2 py-0.5" />
                    <span className="text-xs text-muted-foreground">{formatDuration(item.duration_seconds)}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(item.file_size_bytes)}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {item.status === 'pending_upload' ? 'Local' :
                     item.status === 'uploaded' ? 'Enviado' :
                     item.status === 'transcribed' ? 'Transcrito' :
                     item.status === 'summarized' ? 'Resumido' : item.status}
                  </Badge>
                </div>

                {/* Transcription text */}
                {item.transcription && (
                  <div className="text-sm bg-muted/50 rounded p-2 whitespace-pre-line">
                    {item.transcription}
                  </div>
                )}

                {/* Summary bullets */}
                {item.summary && item.summary.length > 0 && (
                  <div className="text-sm bg-primary/5 rounded p-2 space-y-1">
                    <span className="text-xs font-semibold text-primary">Resumo:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {item.summary.map((s, i) => (
                        <li key={i} className="text-muted-foreground">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end gap-2 pt-1">
                  {/* Transcrever: visible if has audioData and not yet transcribed */}
                  {!item.transcription && item.audioData && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTranscribe(item)}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      {isProcessing && processingAction === 'transcribe' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Type className="h-3.5 w-3.5" />
                      )}
                      Transcrever
                    </Button>
                  )}

                  {/* Resumir: visible if has transcription but no summary */}
                  {item.transcription && (!item.summary || item.summary.length === 0) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSummarize(item)}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      {isProcessing && processingAction === 'summarize' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ListChecks className="h-3.5 w-3.5" />
                      )}
                      Resumir
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(item)}
                    disabled={isProcessing}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
