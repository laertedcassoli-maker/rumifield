import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineChecklistDb } from '@/lib/offline-checklist-db';
import { MAX_ITEM_PHOTOS, PHOTO_TABLE, syncItemPhoto, syncPendingItemPhotos } from '@/lib/checklist-item-photo-sync';

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
 * Lança erro se algum item do checklist que exige foto não tiver nenhuma foto enviada.
 */
export async function assertRequiredPhotos(
  table: ChecklistItemTable,
  blockTable: 'preventive_checklist_blocks' | 'installation_checklist_blocks',
  checklistId: string,
) {
  const sb = supabase as any;
  await syncPendingItemPhotos();
  const { data: blocks, error: bErr } = await sb.from(blockTable).select('id').eq('checklist_id', checklistId);
  if (bErr) throw bErr;
  const blockIds = (blocks ?? []).map((b: any) => b.id);
  if (!blockIds.length) return;
  const { data: items, error: iErr } = await sb
    .from(table)
    .select('id, item_name_snapshot, template_item_id')
    .in('exec_block_id', blockIds);
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
  const exigidos = (items ?? []).filter((i: any) => reqSet.has(i.template_item_id));
  if (!exigidos.length) return;
  const { data: fotos, error: fErr } = await sb
    .from(PHOTO_TABLE[table])
    .select('item_id')
    .in('item_id', exigidos.map((i: any) => i.id));
  if (fErr) throw fErr;
  const comFoto = new Set((fotos ?? []).map((f: any) => f.item_id));
  const faltando = exigidos.filter((i: any) => !comFoto.has(i.id));
  if (!faltando.length) return;
  const locais = new Set(
    (await offlineChecklistDb.checklistItemPhotosV2.where('itemId').anyOf(faltando.map((i: any) => i.id)).toArray())
      .map(r => r.itemId),
  );
  const naoEnviadas = faltando.filter((i: any) => locais.has(i.id));
  if (naoEnviadas.length) {
    throw new Error(
      `Foto ainda não enviada em ${naoEnviadas.length} item(ns). Verifique o sinal e tente novamente.`,
    );
  }
  const nomes = faltando.slice(0, 3).map((i: any) => i.item_name_snapshot).join(', ');
  throw new Error(
    `Foto obrigatória faltando em ${faltando.length} item(ns): ${nomes}${faltando.length > 3 ? '...' : ''}`,
  );
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
  const key = ['checklist-item-photos', table, itemId];

  const { data: sent = [] } = useQuery({
    queryKey: key,
    enabled: isRequired,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(PHOTO_TABLE[table])
        .select('id, photo_path, created_at')
        .eq('item_id', itemId)
        .order('created_at');
      if (error) throw error;
      const rows = (data ?? []) as { id: string; photo_path: string }[];
      if (!rows.length) return [];
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map(r => r.photo_path), 3600);
      return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? null }));
    },
  });

  const locals = useLiveQuery(
    () => offlineChecklistDb.checklistItemPhotosV2.where('itemId').equals(itemId).toArray(),
    [itemId],
  ) ?? [];
  const localUrls = useMemo(() => locals.map(l => ({ localId: l.localId!, url: URL.createObjectURL(l.blob) })), [locals]);
  useEffect(() => () => localUrls.forEach(l => URL.revokeObjectURL(l.url)), [localUrls]);

  const localSig = locals.map(l => l.localId).join(',');
  useEffect(() => {
    if (!locals.length || !navigator.onLine) return;
    let active = true;
    syncItemPhoto(itemId).then(() => {
      if (active) queryClient.invalidateQueries({ queryKey: key });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSig, itemId]);

  if (!isRequired) return null;

  const total = sent.length + locals.length;
  const canAdd = total < MAX_ITEM_PHOTOS;

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!canAdd) {
      toast.error(`Máximo de ${MAX_ITEM_PHOTOS} fotos por item.`);
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      await offlineChecklistDb.checklistItemPhotosV2.add({
        itemId,
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

  const removeSent = async (id: string, path: string) => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).from(PHOTO_TABLE[table]).delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Sem permissão para remover esta foto.');
      await supabase.storage.from(BUCKET).remove([path]);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error('Não foi possível remover a foto. ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  };

  const removeLocal = async (localId: number) => {
    await offlineChecklistDb.checklistItemPhotosV2.delete(localId);
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Camera className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Foto obrigatória deste item</span>
        {locals.length > 0 ? (
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Aguardando envio</Badge>
        ) : sent.length > 0 ? (
          <Badge variant="outline" className="text-xs">Anexada {sent.length}/{MAX_ITEM_PHOTOS}</Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">Pendente</Badge>
        )}
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          {sent.map(p => (
            <div key={p.id} className="relative">
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt="Foto do item" className="h-20 w-20 rounded-md object-cover border" />
                </a>
              )}
              {!readOnly && (
                <Button type="button" size="icon" variant="secondary" disabled={busy}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  aria-label="Remover foto" onClick={() => removeSent(p.id, p.photo_path)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {localUrls.map(l => (
            <div key={l.localId} className="relative">
              <img src={l.url} alt="Foto aguardando envio" className="h-20 w-20 rounded-md object-cover border border-amber-500 opacity-80" />
              {!readOnly && (
                <Button type="button" size="icon" variant="secondary" disabled={busy}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  aria-label="Remover foto" onClick={() => removeLocal(l.localId)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && canAdd && (
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
            Adicionar foto ({total}/{MAX_ITEM_PHOTOS})
          </Button>
        </div>
      )}
    </div>
  );
}
