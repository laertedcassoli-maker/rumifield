import { supabase } from '@/integrations/supabase/client';
import { offlineChecklistDb, type OfflineChecklistItemPhoto } from '@/lib/offline-checklist-db';

const BUCKET = 'preventive-media';
const TIMEOUT_MS = 15_000;

function withTimeout<T>(p: PromiseLike<T>, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Tempo esgotado: ${label}`)), TIMEOUT_MS)),
  ]);
}

/** Envia a foto local de um item. Retorna true se enviou (ou não havia nada). */
export async function syncItemPhoto(itemId: string): Promise<boolean> {
  const rec = await offlineChecklistDb.checklistItemPhotos.get(itemId);
  if (!rec) return true;
  if (!navigator.onLine) return false;
  try {
    await uploadRecord(rec);
    // Só apaga se o registro não foi trocado durante o envio
    const current = await offlineChecklistDb.checklistItemPhotos.get(itemId);
    if (current && current.createdAt === rec.createdAt) {
      await offlineChecklistDb.checklistItemPhotos.delete(itemId);
    }
    return true;
  } catch (e) {
    console.error('[item-photo-sync]', e);
    return false;
  }
}

async function uploadRecord(rec: OfflineChecklistItemPhoto) {
  const path = `${rec.userId}/checklist-items/${rec.id}.${rec.ext}`;
  const { error: upErr } = await withTimeout(
    supabase.storage.from(BUCKET).upload(path, rec.blob, { contentType: rec.mimeType, upsert: true }),
    'envio da foto',
  );
  if (upErr) throw upErr;
  const { data, error } = await withTimeout(
    (supabase as any).from(rec.table).update({ photo_path: path }).eq('id', rec.id).select('id'),
    'gravação da foto',
  ) as { data: any[] | null; error: any };
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
      ? (await offlineChecklistDb.checklistItemPhotos.bulkGet(itemIds)).filter(Boolean) as OfflineChecklistItemPhoto[]
      : await offlineChecklistDb.checklistItemPhotos.toArray();
    for (const rec of all) await syncItemPhoto(rec.id);
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
