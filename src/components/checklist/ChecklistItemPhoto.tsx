import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { offlineChecklistDb } from '@/lib/offline-checklist-db';
import { syncItemPhoto, syncPendingItemPhotos } from '@/lib/checklist-item-photo-sync';

export type ChecklistItemTable = 'preventive_checklist_items' | 'installation_checklist_items';
const BUCKET = 'preventive-media';

/** Conjunto de template items que exigem foto (cache compartilhado). */
export function useRequiredPhotoItems() {
  return useQuery({
    queryKey: ['checklist-template-items-requires-photo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_template_items')
        .select('id')
        .eq('requires_photo', true);
      if (error) throw error;
      return new Set((data ?? []).map(r => r.id));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Lança erro se algum item do checklist que exige foto não tiver foto anexada.
 */
export async function assertRequiredPhotos(
  table: ChecklistItemTable,
  blockTable: 'preventive_checklist_blocks' | 'installation_checklist_blocks',
  checklistId: string,
) {
  const sb = supabase as any;
  // Envia antes as fotos capturadas no aparelho
  await syncPendingItemPhotos();
  const { data: blocks, error: bErr } = await sb.from(blockTable).select('id').eq('checklist_id', checklistId);
  if (bErr) throw bErr;
  const blockIds = (blocks ?? []).map((b: any) => b.id);
  if (!blockIds.length) return;
  const { data: items, error: iErr } = await sb
    .from(table)
    .select('id, item_name_snapshot, template_item_id, photo_path')
    .in('exec_block_id', blockIds)
    .is('photo_path', null);
  if (iErr) throw iErr;
  const templateIds = [...new Set((items ?? []).map((i: any) => i.template_item_id).filter(Boolean))];
  if (!templateIds.length) return;
  const { data: req, error: rErr } = await supabase
    .from('checklist_template_items')
    .select('id')
    .in('id', templateIds as string[])
    .eq('requires_photo', true);
  if (rErr) throw rErr;
  const reqSet = new Set((req ?? []).map(r => r.id));
  const faltando = (items ?? []).filter((i: any) => reqSet.has(i.template_item_id));
  const locais = new Set(
    (await offlineChecklistDb.checklistItemPhotos.bulkGet(faltando.map((i: any) => i.id)))
      .filter(Boolean)
      .map(r => r!.id),
  );
  const naoEnviadas = faltando.filter((i: any) => locais.has(i.id));
  if (naoEnviadas.length) {
    throw new Error(
      `Foto ainda não enviada em ${naoEnviadas.length} item(ns). Verifique o sinal e tente novamente.`,
    );
  }
  if (faltando.length) {
    const nomes = faltando.slice(0, 3).map((i: any) => i.item_name_snapshot).join(', ');
    throw new Error(
      `Foto obrigatória faltando em ${faltando.length} item(ns): ${nomes}${faltando.length > 3 ? '...' : ''}`,
    );
  }
}

interface Props {
  table: ChecklistItemTable;
  itemId: string;
  templateItemId: string | null;
  readOnly?: boolean;
}

export default function ChecklistItemPhoto({ table, itemId, templateItemId, readOnly }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data: required } = useRequiredPhotoItems();
  const isRequired = !!templateItemId && !!required?.has(templateItemId);
  const key = ['checklist-item-photo', table, itemId];

  const { data: photo } = useQuery({
    queryKey: key,
    enabled: isRequired,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table).select('photo_path').eq('id', itemId).maybeSingle();
      if (error) throw error;
      const path: string | null = data?.photo_path ?? null;
      if (!path) return { path: null, url: null };
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      return { path, url: signed?.signedUrl ?? null };
    },
  });

  const local = useLiveQuery(
    () => offlineChecklistDb.checklistItemPhotos.get(itemId),
    [itemId],
  );
  const localUrl = useMemo(() => (local ? URL.createObjectURL(local.blob) : null), [local]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  // Tenta enviar pendência deste item ao abrir / quando sair do aparelho, recarrega o estado
  useEffect(() => {
    if (!local || !navigator.onLine) return;
    let active = true;
    syncItemPhoto(itemId).then(ok => {
      if (ok && active) queryClient.invalidateQueries({ queryKey: key });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.createdAt, itemId]);

  if (!isRequired) return null;

  const hasLocal = !!local;
  const displayUrl = localUrl ?? photo?.url ?? null;

  const setPath = async (path: string | null) => {
    const { data, error } = await (supabase as any)
      .from(table)
      .update({ photo_path: path })
      .eq('id', itemId)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Sem permissão para salvar a foto deste item.');
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      await offlineChecklistDb.checklistItemPhotos.put({
        id: itemId,
        table,
        blob: file,
        mimeType: file.type || 'image/jpeg',
        ext,
        userId: user.id,
        createdAt: new Date().toISOString(),
        _pendingSync: 1,
      });
      if (navigator.onLine) {
        const ok = await syncItemPhoto(itemId);
        await queryClient.invalidateQueries({ queryKey: key });
        toast.success(ok ? 'Foto do item anexada.' : 'Foto salva no aparelho. Será enviada quando houver conexão.');
      } else {
        toast.success('Foto salva no aparelho. Será enviada quando houver conexão.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível anexar a foto: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await offlineChecklistDb.checklistItemPhotos.delete(itemId);
      if (photo?.path) await setPath(null);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error('Não foi possível remover a foto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Foto obrigatória deste item</span>
        {hasLocal ? (
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Aguardando envio</Badge>
        ) : photo?.path ? (
          <Badge variant="outline" className="text-xs">Anexada</Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">Pendente</Badge>
        )}
      </div>
      {displayUrl && (
        <a href={displayUrl} target="_blank" rel="noreferrer">
          <img src={displayUrl} alt="Foto do item" className="h-24 w-24 rounded-md object-cover border" />
        </a>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Camera className="h-4 w-4 mr-1.5" />}
            {photo?.path || hasLocal ? 'Trocar foto' : 'Anexar foto'}
          </Button>
          {(photo?.path || hasLocal) && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={handleRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
