import { supabase } from '@/integrations/supabase/client';

const TIMEOUT_MS = 12_000;

function withTimeout<T>(p: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}

function stamp() {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export const canHardDeleteTicket = (status?: string | null) => status === 'aberto';
export const canHardDeleteCorrectiveVisit = (status?: string | null) =>
  status === 'em_elaboracao' || status === 'planejada';

const SUBSTATUS_LABELS: Record<string, string> = {
  aguardando_visita: 'aguardando visita',
  aguardando_peca: 'aguardando peça',
  aguardando_cliente: 'aguardando cliente',
};

export async function cancelTicket(ticketId: string, reason: string, userId: string) {
  const motivo = reason.trim();
  if (!motivo) throw new Error('Informe o motivo do cancelamento.');
  // Lê o substatus atual para registrá-lo na linha do tempo (a constraint exige substatus NULL fora de em_atendimento).
  // Se a leitura falhar, segue com o cancelamento normalmente.
  let substatusAtual: string | null = null;
  try {
    const { data: atual } = await withTimeout(
      supabase.from('technical_tickets').select('substatus').eq('id', ticketId).maybeSingle(),
    );
    substatusAtual = atual?.substatus ?? null;
  } catch (e) {
    console.warn('[cancelTicket] falha ao ler substatus atual', e);
  }
  const { data, error } = await withTimeout(
    supabase.from('technical_tickets').update({ status: 'cancelado', substatus: null }).eq('id', ticketId).select('id'),
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('O cancelamento não foi confirmado pelo servidor. Verifique suas permissões.');
  const detalheSubstatus = substatusAtual
    ? ` (estava em atendimento: ${SUBSTATUS_LABELS[substatusAtual] ?? substatusAtual})`
    : '';
  const { error: tlError } = await withTimeout(
    supabase.from('ticket_timeline').insert({
      ticket_id: ticketId,
      user_id: userId,
      event_type: 'cancelamento',
      event_description: `Chamado cancelado em ${stamp()}${detalheSubstatus}`,
      notes: motivo,
    }),
  );
  if (tlError) console.warn('[cancelTicket] falha ao registrar na linha do tempo', tlError);
}

export async function cancelCorrectiveVisit(visitId: string, reason: string, currentInternalNotes?: string | null) {
  const motivo = reason.trim();
  if (!motivo) throw new Error('Informe a justificativa do cancelamento.');
  const note = `[Cancelada em ${stamp()}] ${motivo}`;
  const internal_notes = currentInternalNotes ? `${currentInternalNotes}\n\n${note}` : note;
  const { data, error } = await withTimeout(
    supabase.from('ticket_visits').update({ status: 'cancelada', internal_notes }).eq('id', visitId).select('id'),
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('O cancelamento não foi confirmado pelo servidor. Verifique suas permissões.');

  // Cascata: visita que "contou como preventiva"
  const { data: cms, error: cmError } = await withTimeout(
    supabase.from('corrective_maintenance').select('preventive_maintenance_id').eq('visit_id', visitId).not('preventive_maintenance_id', 'is', null),
  );
  if (cmError) throw cmError;
  const pmIds = Array.from(new Set((cms ?? []).map((c) => c.preventive_maintenance_id).filter(Boolean))) as string[];
  if (pmIds.length > 0) {
    const { error: pmError } = await withTimeout(
      supabase.from('preventive_maintenance').update({ status: 'cancelada', notes: `Cancelada junto com a visita corretiva: ${motivo}` }).in('id', pmIds).select('id'),
    );
    if (pmError) throw pmError;
  }
}
