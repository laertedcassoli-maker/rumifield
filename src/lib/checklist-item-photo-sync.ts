import { supabase } from '@/integrations/supabase/client';
import { offlineChecklistDb, type OfflineChecklistItemPhoto } from '@/lib/offline-checklist-db';

const BUCKET = 'preventive-media';
const TIMEOUT_MS = 15_000;
export const MAX_ITEM_PHOTOS = 5;

export const PHOTO_TABLE: Record<OfflineChecklistItemPhoto['table'], string> = {
  preventive_checklist_items: 'preventive_checklist_item_photos',
  installation_checklist_items: 'installation_checklist_item_photos',
};

function withTimeout<T>(p: PromiseLike<T>, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Tempo esgotado: ${label}`)), TIMEOUT_MS)),
  ]);
}

const photos = () => offlineChecklistDb.checklistItemPhotosV2;

const inFlight = new Map<string, Promise<boolean>>();

/** Envia todas as fotos locais de um item. Retorna true se não sobrou nenhuma pendente.
 *  Chamadas simultâneas para o mesmo item reaproveitam o envio em andamento. */
export function syncItemPhoto(itemId: string): Promise<boolean> {
  const cur = inFlight.get(itemId);
  if (cur) return cur;
  const p = doSyncItemPhoto(itemId).finally(() => inFlight.delete(itemId));
  inFlight.set(itemId, p);
  return p;
}

async function doSyncItemPhoto(itemId: string): Promise<boolean> {
  const recs = await photos().where('itemId').equals(itemId).toArray();
  if (!recs.length) return true;
  if (!navigator.onLine) return false;
  let ok = true;
  for (const rec of recs) {
    try {
      await uploadRecord(rec);
      await photos().delete(rec.localId!);
    } catch (e) {
      console.error('[item-photo-sync]', e);
      ok = false;
    }
  }
  return ok;
}

async function uploadRecord(rec: OfflineChecklistItemPhoto) {
  const stamp = new Date(rec.createdAt).getTime();
  const path = `${rec.userId}/checklist-items/${rec.itemId}/${rec.localId}-${stamp}.${rec.ext}`;
  const { error: upErr } = await withTimeout(
    supabase.storage.from(BUCKET).upload(path, rec.blob, { contentType: rec.mimeType, upsert: true }),
    'envio da foto',
  );
  if (upErr) throw upErr;
  const sb = supabase as any;
  // Evita duplicar a linha se uma tentativa anterior já gravou
  const { data: existing } = await sb.from(PHOTO_TABLE[rec.table]).select('id').eq('item_id', rec.itemId).eq('photo_path', path);
  if (existing?.length) return;
  const { data, error } = await withTimeout(
    sb.from(PHOTO_TABLE[rec.table]).insert({ item_id: rec.itemId, photo_path: path, created_by_user_id: rec.userId }).select('id'),
    'gravação da foto',
  ) as { data: any[] | null; error: any };
  if (error?.code === '23505') return; // já gravada (retry idempotente)
  if (error) throw error;
  if (!data?.length) throw new Error('Sem permissão para salvar a foto deste item.');
}

let running: Promise<void> | null = null;

/** Envia todas as fotos pendentes (ou só as dos itens informados). */
export async function syncPendingItemPhotos(itemIds?: string[]): Promise<void> {
  if (!navigator.onLine) return;
  if (running) await running;
  running = (async () => {
    const all = itemIds
      ? await photos().where('itemId').anyOf(itemIds).toArray()
      : await photos().toArray();
    for (const id of [...new Set(all.map(r => r.itemId))]) await syncItemPhoto(id);
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingItemPhotos().catch(console.error);
  });
}
