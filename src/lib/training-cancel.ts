import { supabase } from '@/integrations/supabase/client';
import { offlineChecklistDb } from '@/lib/offline-checklist-db';

const TIMEOUT_MS = 12_000;
const sb = supabase as any;

function withTimeout(p: PromiseLike<any>, ms = TIMEOUT_MS): Promise<any> {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}

/** Exclusão real só para visita pendente sem respostas de checklist (o banco também exige). */
export const canHardDeleteTrainingVisit = (status?: string | null, responseCount = 0) =>
  status === 'pendente' && responseCount === 0;

/** Visita cancelada localmente não pode ser executada nem sincronizada. */
export async function isTrainingVisitCancelledLocally(visitId?: string | null) {
  if (!visitId) return false;
  try {
    const v = await offlineChecklistDb.trainingVisits.get(visitId);
    return v?.status === 'cancelada';
  } catch {
    return false;
  }
}

export async function hardDeleteTrainingVisit(id: string) {
  const { data, error } = await withTimeout(sb.from('training_visits').delete().eq('id', id).select('id'));
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('A exclusão não foi confirmada pelo servidor. Verifique suas permissões.');
}

/** Cancela a visita guardando o motivo (com data/hora) nas observações, sem apagar o que havia. */
export async function cancelTrainingVisit(id: string, reason: string, currentNotes?: string | null) {
  const motivo = reason.trim();
  if (!motivo) throw new Error('Informe o motivo do cancelamento.');
  const stamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const note = `[Cancelada em ${stamp}] ${motivo}`;
  const notes = currentNotes ? `${currentNotes}\n\n${note}` : note;
  const { data, error } = await withTimeout(
    sb.from('training_visits').update({ status: 'cancelada', notes }).eq('id', id).select('id'),
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('O cancelamento não foi confirmado pelo servidor. Verifique suas permissões.');
  try {
    const local = await offlineChecklistDb.trainingVisits.get(id);
    if (local) await offlineChecklistDb.trainingVisits.update(id, { status: 'cancelada', notes });
  } catch { /* cache local é opcional */ }
}
