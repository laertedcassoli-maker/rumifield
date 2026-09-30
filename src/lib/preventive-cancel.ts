import { supabase } from '@/integrations/supabase/client';

const TIMEOUT_MS = 15_000;
const DELETABLE_ITEM = ['planejado', 'reagendado'];

export const canDeleteRouteItem = (status?: string | null) => DELETABLE_ITEM.includes(status ?? '');
export const canDeleteRoute = (status?: string | null) => status === 'em_elaboracao';

function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique a conexão.')), TIMEOUT_MS)),
  ]);
}

/**
 * Cancela uma visita de rota preventiva: item 'cancelado' + preventive_maintenance 'cancelada'
 * (mesma lógica do cancelamento online de ExecucaoRota).
 */
export async function cancelPreventiveRouteItem(itemId: string, justification: string) {
  const run = async () => {
    const { data: item, error: iErr } = await supabase
      .from('preventive_route_items')
      .select('id, route_id, client_id, preventive_routes(start_date, field_technician_user_id)')
      .eq('id', itemId)
      .maybeSingle();
    if (iErr) throw iErr;
    if (!item) throw new Error('Visita não encontrada.');
    const route: any = (item as any).preventive_routes;

    const { data: upd, error: uErr } = await supabase
      .from('preventive_route_items')
      .update({ status: 'cancelado' } as any)
      .eq('id', itemId)
      .select('id');
    if (uErr) throw uErr;
    if (!upd?.length) throw new Error('Sem permissão para cancelar esta visita.');

    const { data: pm } = await supabase
      .from('preventive_maintenance')
      .select('id')
      .eq('client_id', item.client_id)
      .eq('route_id', item.route_id)
      .maybeSingle();
    if (pm) {
      const { error } = await supabase
        .from('preventive_maintenance')
        .update({ status: 'cancelada', notes: justification, updated_at: new Date().toISOString() })
        .eq('id', pm.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('preventive_maintenance').insert({
        client_id: item.client_id,
        route_id: item.route_id,
        scheduled_date: route?.start_date || new Date().toISOString().split('T')[0],
        status: 'cancelada',
        notes: justification,
        technician_user_id: route?.field_technician_user_id,
      });
      if (error) throw error;
    }
  };
  await withTimeout(run());
}

/**
 * Cancela a rota inteira: visitas ainda planejadas/reagendadas são canceladas,
 * visitas já executadas não são tocadas.
 */
export async function cancelPreventiveRoute(routeId: string, justification: string) {
  const { data: items, error } = await withTimeout(
    supabase.from('preventive_route_items').select('id, status').eq('route_id', routeId),
  );
  if (error) throw error;
  for (const it of (items ?? []).filter(i => DELETABLE_ITEM.includes(i.status))) {
    await cancelPreventiveRouteItem(it.id, `Rota cancelada: ${justification}`);
  }
  const { data, error: rErr } = await withTimeout(
    supabase.from('preventive_routes').update({ status: 'cancelada' } as any).eq('id', routeId).select('id'),
  );
  if (rErr) throw rErr;
  if (!data?.length) throw new Error('Sem permissão para cancelar esta rota.');
}
