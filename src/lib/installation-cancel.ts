import { supabase } from '@/integrations/supabase/client';

const TIMEOUT_MS = 12_000;
const sb = supabase as any;

function withTimeout(p: PromiseLike<any>, ms = TIMEOUT_MS): Promise<any> {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}

const stamp = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const canHardDeleteStage = (status?: string | null) => status === 'planejado';
export const canHardDeleteInstallation = (stages: { status: string }[]) =>
  stages.every((s) => s.status === 'planejado');

async function cancelStagesByIds(ids: string[], note: string) {
  if (ids.length === 0) return;
  const { data: rows, error } = await withTimeout(
    sb.from('installation_stages').select('id, observacao_interna').in('id', ids),
  );
  if (error) throw error;
  for (const r of (rows ?? []) as { id: string; observacao_interna: string | null }[]) {
    const obs = r.observacao_interna ? `${r.observacao_interna}\n\n${note}` : note;
    const { data, error: upErr } = await withTimeout(
      sb.from('installation_stages').update({ status: 'cancelado', observacao_interna: obs }).eq('id', r.id).select('id'),
    );
    if (upErr) throw upErr;
    if (!data || data.length === 0) throw new Error('O cancelamento da etapa não foi confirmado pelo servidor. Verifique suas permissões.');
  }
}

export async function cancelStage(stageId: string, reason: string) {
  const motivo = reason.trim();
  if (!motivo) throw new Error('Informe a justificativa do cancelamento.');
  await cancelStagesByIds([stageId], `[Etapa cancelada em ${stamp()}] ${motivo}`);
}

export async function cancelInstallation(installationId: string, reason: string) {
  const motivo = reason.trim();
  if (!motivo) throw new Error('Informe a justificativa do cancelamento.');
  const { data, error } = await withTimeout(
    sb.from('installations').update({ status: 'cancelado' }).eq('id', installationId).select('id'),
  );
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('O cancelamento não foi confirmado pelo servidor. Verifique suas permissões.');

  // Cascata: só etapas ainda não iniciadas
  const { data: pend, error: pErr } = await withTimeout(
    sb.from('installation_stages').select('id').eq('installation_id', installationId).eq('status', 'planejado'),
  );
  if (pErr) throw pErr;
  await cancelStagesByIds(
    ((pend ?? []) as { id: string }[]).map((s) => s.id),
    `[Instalação cancelada em ${stamp()}] ${motivo}`,
  );
}
