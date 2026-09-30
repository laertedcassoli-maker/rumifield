import { supabase } from '@/integrations/supabase/client';

const TIMEOUT_MS = 12_000;
const sb = supabase as any;

function withTimeout(p: PromiseLike<any>, ms = TIMEOUT_MS): Promise<any> {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}

export const canHardDeleteWorkOrder = (status?: string | null) => status === 'aguardando';

/** Exclusão definitiva (só OS 'aguardando' — o banco também exige). */
export async function hardDeleteWorkOrder(id: string) {
  const t1 = await sb.from('work_order_tag_links').delete().eq('work_order_id', id);
  if (t1.error) throw t1.error;
  const t2 = await sb.from('work_order_parts_used').delete().eq('work_order_id', id);
  if (t2.error) throw t2.error;
  const t3 = await sb.from('work_order_time_entries').delete().eq('work_order_id', id);
  if (t3.error) throw t3.error;
  const t4 = await sb.from('work_order_items').delete().eq('work_order_id', id);
  if (t4.error) throw t4.error;
  const t5 = await sb.from('work_orders').delete().eq('id', id).select('id');
  if (t5.error) throw t5.error;
  if (!t5.data || t5.data.length === 0) throw new Error('A exclusão não foi confirmada pelo servidor. Verifique suas permissões.');
}

/** Cancela a OS guardando o motivo (com data/hora) nas observações, sem apagar o que havia. */
export async function cancelWorkOrder(id: string, reason: string) {
  const motivo = reason.trim();
  if (!motivo) throw new Error('Informe o motivo do cancelamento.');
  const { data: cur, error: curErr } = await withTimeout(sb.from('work_orders').select('notes').eq('id', id).maybeSingle());
  if (curErr) throw curErr;
  const stamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const note = `[Cancelada em ${stamp}] ${motivo}`;
  const notes = cur?.notes ? `${cur.notes}\n\n${note}` : note;
  const { data, error } = await withTimeout(
    sb.from('work_orders').update({ status: 'cancelada', notes }).eq('id', id).select('id'),
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('O cancelamento não foi confirmado pelo servidor. Verifique suas permissões.');
}
