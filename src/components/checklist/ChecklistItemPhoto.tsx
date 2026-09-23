import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const { data: blocks, error: bErr } = await sb.from(blockTable).select('id').eq('checklist_id', checklistId);
  if (bErr) throw bErr;
  const blockIds = (blocks ?? []).map((b: any) => b.id);
  if (!blockIds.length) return;
  const { data: items, error: iErr } = await sb
    .from(table)
    .select('item_name_snapshot, template_item_id, photo_path')
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

  if (!isRequired) return null;

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
    if (!navigator.onLine) {
      toast.error('Sem conexão. Reconecte para anexar a foto.');
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/checklist-items/${itemId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      try {
        await setPath(path);
      } catch (e) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw e;
      }
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success('Foto do item anexada.');
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
      await setPath(null);
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
        {photo?.path ? (
          <Badge variant="outline" className="text-xs">Anexada</Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">Pendente</Badge>
        )}
      </div>
      {photo?.url && (
        <a href={photo.url} target="_blank" rel="noreferrer">
          <img src={photo.url} alt="Foto do item" className="h-24 w-24 rounded-md object-cover border" />
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
            {photo?.path ? 'Trocar foto' : 'Anexar foto'}
          </Button>
          {photo?.path && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={handleRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
