// Estoque Uso/Consumo dentro da Visita Técnica (preventiva/corretiva).
// Offline-first: lançamento gravado no aparelho; com sinal vai direto ao banco,
// sem sinal entra na fila de sincronização do checklist.
import { supabase } from '@/integrations/supabase/client';
import { offlineChecklistDb, type OfflineEstoqueMov } from '@/lib/offline-checklist-db';

const sb = supabase as any;

// Marcadores em notes para vincular lançamentos
export const NOTE_PURE = 'uc';                       // saída de item Uso/Consumo puro
export const notePeca = (consumptionId: string) => `peca:${consumptionId}`;
export const noteEstorno = (ref: string) => `estorno:${ref}`; // ref = movId (puro) ou peca:<id>

function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error('Tempo esgotado'), { _timeout: true })), ms)),
  ]);
}

const signed = (m: { tipo: string; quantidade: number }) => (m.tipo === 'entrada' ? 1 : -1) * Number(m.quantidade);
const saldoKey = (tec: string, item: string) => `${tec}|${item}`;

/** Atualiza cache de itens ativos e saldo do técnico (só com sinal). */
export async function refreshEstoqueCache(tecnicoId: string): Promise<void> {
  const [{ data: itens, error: e1 }, { data: movs, error: e2 }] = await Promise.all([
    sb.from('estoque_consumo_itens').select('id, codigo, descricao, peca_id, ativo, unidade, controle_consumo').eq('ativo', true),
    sb.from('estoque_consumo_movimentos').select('id, item_id, tipo, quantidade')
      .eq('local', 'tecnico').eq('tecnico_user_id', tecnicoId),
  ]);
  if (e1 || e2) throw e1 || e2;
  const serverIds = new Set<string>((movs ?? []).map((m: any) => m.id));
  const saldo = new Map<string, number>();
  (movs ?? []).forEach((m: any) => saldo.set(m.item_id, (saldo.get(m.item_id) ?? 0) + signed(m)));
  await offlineChecklistDb.transaction('rw', offlineChecklistDb.estoqueConsumoItens, offlineChecklistDb.estoqueSaldoTecnico, offlineChecklistDb.estoqueMovimentosLocais, async () => {
    await offlineChecklistDb.estoqueConsumoItens.clear();
    await offlineChecklistDb.estoqueConsumoItens.bulkPut(itens ?? []);
    await offlineChecklistDb.estoqueSaldoTecnico.where('tecnico_user_id').equals(tecnicoId).delete();
    await offlineChecklistDb.estoqueSaldoTecnico.bulkPut(
      [...saldo.entries()].map(([item_id, s]) => ({ key: saldoKey(tecnicoId, item_id), tecnico_user_id: tecnicoId, item_id, saldo: s })),
    );
    // Lançamentos locais que já estão no servidor deixam de ser pendentes
    const locais = await offlineChecklistDb.estoqueMovimentosLocais.toArray();
    for (const l of locais) if (l._pendingSync && serverIds.has(l.id)) await offlineChecklistDb.estoqueMovimentosLocais.update(l.id, { _pendingSync: false });
  });
}

/** Saldo do técnico = cache do servidor + lançamentos locais ainda não enviados. */
export async function getSaldoTecnico(tecnicoId: string, itemId: string): Promise<number> {
  const cached = (await offlineChecklistDb.estoqueSaldoTecnico.get(saldoKey(tecnicoId, itemId)))?.saldo ?? 0;
  const pend = (await offlineChecklistDb.estoqueMovimentosLocais.toArray())
    .filter(m => m._pendingSync && m.tecnico_user_id === tecnicoId && m.item_id === itemId)
    .reduce((s, m) => s + signed(m), 0);
  return cached + pend;
}

export async function findItemByPeca(pecaId: string) {
  return (await offlineChecklistDb.estoqueConsumoItens.where('peca_id').equals(pecaId).toArray()).find(i => i.ativo && i.controle_consumo !== 'a_granel') ?? null;
}

async function bumpCachedSaldo(m: OfflineEstoqueMov) {
  const key = saldoKey(m.tecnico_user_id, m.item_id);
  const cur = await offlineChecklistDb.estoqueSaldoTecnico.get(key);
  await offlineChecklistDb.estoqueSaldoTecnico.put({ key, tecnico_user_id: m.tecnico_user_id, item_id: m.item_id, saldo: (cur?.saldo ?? 0) + signed(m) });
}

const toRow = (m: OfflineEstoqueMov) => ({
  id: m.id, item_id: m.item_id, tipo: m.tipo, quantidade: m.quantidade, local: 'tecnico',
  tecnico_user_id: m.tecnico_user_id, origem_tipo: 'visita', origem_id: m.origem_id, notes: m.notes,
  created_by_user_id: m.created_by_user_id,
});

/** Grava um movimento (saída ou estorno) da visita, offline-first. */
export async function registrarMovimentoVisita(
  input: Omit<OfflineEstoqueMov, 'id' | 'created_at' | '_pendingSync' | 'local' | 'origem_tipo'>,
  isOnline: boolean,
): Promise<OfflineEstoqueMov> {
  const mov: OfflineEstoqueMov = {
    ...input, id: crypto.randomUUID(), local: 'tecnico', origem_tipo: 'visita',
    created_at: new Date().toISOString(), _pendingSync: true,
  };
  await offlineChecklistDb.estoqueMovimentosLocais.put(mov);
  if (isOnline) {
    try {
      const { data, error } = await withTimeout<any>(sb.from('estoque_consumo_movimentos').insert(toRow(mov)).select('id'));
      if (error) {
        await offlineChecklistDb.estoqueMovimentosLocais.delete(mov.id);
        throw new Error(error.message);
      }
      if (!data?.length) {
        await offlineChecklistDb.estoqueMovimentosLocais.delete(mov.id);
        throw new Error('Sem permissão para movimentar o estoque.');
      }
      await offlineChecklistDb.estoqueMovimentosLocais.update(mov.id, { _pendingSync: false });
      await bumpCachedSaldo(mov);
      return { ...mov, _pendingSync: false };
    } catch (e: any) {
      if (!e?._timeout && !(e instanceof TypeError)) throw e; // erro real: não enfileira
    }
  }
  await offlineChecklistDb.addToSyncQueue('estoque_consumo_movimentos', 'insert', toRow(mov));
  return mov;
}

/** Usado pelo processador da fila. */
export async function syncMovimentoVisita(data: Record<string, unknown>): Promise<void> {
  const { error } = await sb.from('estoque_consumo_movimentos').upsert(data, { onConflict: 'id', ignoreDuplicates: true });
  if (error && error.code !== '23505') throw error;
  const local = await offlineChecklistDb.estoqueMovimentosLocais.get(data.id as string);
  if (local?._pendingSync) {
    await offlineChecklistDb.estoqueMovimentosLocais.update(local.id, { _pendingSync: false });
    await bumpCachedSaldo(local);
  }
}

export type VisitaMov = OfflineEstoqueMov & { item_codigo?: string; item_descricao?: string };

/** Movimentos da visita (servidor) — mesclados com locais pendentes na tela. */
export async function fetchMovimentosVisita(preventiveId: string): Promise<VisitaMov[]> {
  const { data, error } = await sb.from('estoque_consumo_movimentos')
    .select('id, item_id, tipo, quantidade, local, tecnico_user_id, origem_tipo, origem_id, notes, created_by_user_id, created_at, item:estoque_consumo_itens(codigo, descricao)')
    .eq('origem_tipo', 'visita').eq('origem_id', preventiveId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((m: any) => ({ ...m, quantidade: Number(m.quantidade), _pendingSync: false, item_codigo: m.item?.codigo, item_descricao: m.item?.descricao }));
}

/** Saída ainda ativa (sem estorno) vinculada a uma peça real da visita. */
export function saidaAtivaDaPeca(movs: VisitaMov[], consumptionId: string): VisitaMov | null {
  const ref = notePeca(consumptionId);
  const saidas = movs.filter(m => m.tipo === 'saida' && m.notes === ref);
  const estornos = movs.filter(m => m.tipo === 'entrada' && m.notes === noteEstorno(ref)).length;
  return saidas.length > estornos ? saidas[saidas.length - 1] : null;
}

/** Itens Uso/Consumo puros ativos (sem estorno) da visita. */
export function itensPurosAtivos(movs: VisitaMov[]): VisitaMov[] {
  const estornados = new Set(movs.filter(m => m.tipo === 'entrada' && m.notes?.startsWith('estorno:')).map(m => m.notes!.slice(8)));
  return movs.filter(m => m.tipo === 'saida' && m.notes === NOTE_PURE && !estornados.has(m.id));
}
