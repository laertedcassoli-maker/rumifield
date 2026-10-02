import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Box, Loader2, Minus, Pencil, Plus, Search, Shield } from 'lucide-react';

type Item = { id: string; codigo: string; descricao: string; peca_id: string | null; ativo: boolean; estoque_minimo: number | null };
type Mov = {
  id: string; item_id: string; tipo: 'entrada' | 'saida'; quantidade: number; local: 'centro_servicos' | 'tecnico';
  tecnico_user_id: string | null; origem_tipo: string; notes: string | null; created_by_user_id: string | null; created_at: string;
};
type Row = { key: string; item: Item; local: 'centro_servicos' | 'tecnico'; tecnicoId: string | null; saldo: number };

const ORIGEM_LABEL: Record<string, string> = {
  inventario_inicial: 'Inventário inicial', carrinho: 'Carrinho', os: 'OS', visita: 'Visita', pedido: 'Pedido', ajuste: 'Ajuste',
};

function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export default function EstoqueUsoConsumo() {
  const { user } = useAuth();
  const { canAccess, canEdit, canDelete, isLoading: permLoading } = useMenuPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filtro, setFiltro] = useState<'todos' | 'centro' | 'tecnico'>('todos');
  const [tecnicoSel, setTecnicoSel] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [historico, setHistorico] = useState<Row | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [movOpen, setMovOpen] = useState<null | 'entrada' | 'saida'>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);

  const podeEditar = canEdit('estoque_uso_consumo');
  const podeSaida = canDelete('estoque_uso_consumo');

  const { data: itens = [], isLoading: l1 } = useQuery({
    queryKey: ['estoque-consumo-itens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_consumo_itens').select('id, codigo, descricao, peca_id, ativo, estoque_minimo').order('codigo');
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: movs = [], isLoading: l2 } = useQuery({
    queryKey: ['estoque-consumo-movimentos'],
    queryFn: async () => {
      const all: Mov[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('estoque_consumo_movimentos').select('*')
          .order('created_at', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        all.push(...(data as Mov[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    movs.forEach(m => { if (m.tecnico_user_id) s.add(m.tecnico_user_id); if (m.created_by_user_id) s.add(m.created_by_user_id); });
    return [...s];
  }, [movs]);

  const { data: nomes = {} } = useQuery({
    queryKey: ['estoque-consumo-nomes', userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome').in('id', userIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map((p: any) => [p.id, p.nome || '—'])) as Record<string, string>;
    },
  });

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const byId = new Map(itens.map(i => [i.id, i]));
    for (const m of movs) {
      const item = byId.get(m.item_id);
      if (!item) continue;
      const key = `${m.item_id}|${m.local}|${m.tecnico_user_id ?? ''}`;
      const r = map.get(key) ?? { key, item, local: m.local, tecnicoId: m.tecnico_user_id, saldo: 0 };
      r.saldo += (m.tipo === 'entrada' ? 1 : -1) * Number(m.quantidade);
      map.set(key, r);
    }
    // Itens sem movimento no Centro de Serviços aparecem com 0
    for (const item of itens) {
      const key = `${item.id}|centro_servicos|`;
      if (!map.has(key)) map.set(key, { key, item, local: 'centro_servicos', tecnicoId: null, saldo: 0 });
    }
    return [...map.values()].sort((a, b) => a.item.codigo.localeCompare(b.item.codigo));
  }, [itens, movs]);

  const tecnicosComSaldo = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.local === 'tecnico' && r.tecnicoId && r.saldo > 0) s.add(r.tecnicoId); });
    return [...s].sort((a, b) => (nomes[a] || '').localeCompare(nomes[b] || ''));
  }, [rows, nomes]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (filtro === 'centro' && r.local !== 'centro_servicos') return false;
      if (filtro === 'tecnico') {
        if (r.local !== 'tecnico') return false;
        if (tecnicoSel && r.tecnicoId !== tecnicoSel) return false;
        if (r.saldo <= 0) return false;
      }
      if (q && !r.item.codigo.toLowerCase().includes(q) && !r.item.descricao.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filtro, tecnicoSel, busca]);

  const saldoCentro = (itemId: string) =>
    rows.find(r => r.item.id === itemId && r.local === 'centro_servicos')?.saldo ?? 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['estoque-consumo-itens'] });
    qc.invalidateQueries({ queryKey: ['estoque-consumo-movimentos'] });
  };

  if (permLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!canAccess('estoque_uso_consumo')) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Shield className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Acesso Restrito</h3>
      </div>
    );
  }

  const localLabel = (r: Row) => r.local === 'centro_servicos' ? 'Centro de Serviços' : (nomes[r.tecnicoId!] || 'Técnico');
  const historicoMovs = historico
    ? movs.filter(m => m.item_id === historico.item.id && m.local === historico.local && (m.tecnico_user_id ?? null) === historico.tecnicoId)
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Estoque Uso/Consumo</h1>
          <p className="text-muted-foreground">Saldo por item no Centro de Serviços e com cada técnico</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEditar && <Button variant="outline" onClick={() => setNovoOpen(true)}><Box className="mr-2 h-4 w-4" />Novo item</Button>}
          {podeEditar && <Button onClick={() => setMovOpen('entrada')}><Plus className="mr-2 h-4 w-4" />Dar entrada</Button>}
          {podeSaida && <Button variant="secondary" onClick={() => setMovOpen('saida')}><Minus className="mr-2 h-4 w-4" />Dar saída</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([['todos', 'Todos'], ['centro', 'Centro de Serviços'], ['tecnico', 'Por técnico']] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={filtro === k ? 'default' : 'outline'} onClick={() => setFiltro(k)}>{l}</Button>
        ))}
        {filtro === 'tecnico' && (
          <Select value={tecnicoSel || '_all'} onValueChange={v => setTecnicoSel(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Técnico" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os técnicos</SelectItem>
              {tecnicosComSaldo.map(id => <SelectItem key={id} value={id}>{nomes[id] || id}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar código ou descrição" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {l1 || l2 ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  {podeEditar && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={podeEditar ? 5 : 4} className="text-center text-muted-foreground py-8">Nenhum item encontrado</TableCell></TableRow>
                )}
                {filtered.map(r => {
                  const baixo = r.local === 'centro_servicos' && r.item.estoque_minimo != null && r.saldo < Number(r.item.estoque_minimo);
                  return (
                  <TableRow key={r.key} className={`cursor-pointer ${baixo ? 'bg-destructive/10 hover:bg-destructive/15' : ''}`} onClick={() => setHistorico(r)}>
                    <TableCell className="font-medium">{r.item.codigo}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{r.item.descricao}</span>
                        {r.item.peca_id && <Badge variant="outline">Controlado</Badge>}
                        {!r.item.ativo && <Badge variant="secondary">Inativo</Badge>}
                        {baixo && <Badge variant="destructive">Estoque baixo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{localLabel(r)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.saldo)}</TableCell>
                    {podeEditar && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" aria-label="Editar item" onClick={() => setEditItem(r.item)}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historico} onOpenChange={o => !o && setHistorico(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{historico?.item.codigo} — {historico?.item.descricao}</DialogTitle>
          </DialogHeader>
          {historico && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{localLabel(historico)} · Saldo atual: <strong>{fmt(historico.saldo)}</strong></p>
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Origem</TableHead><TableHead>Registrado por</TableHead><TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoMovs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem movimentos</TableCell></TableRow>}
                    {historicoMovs.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{new Date(m.created_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell><Badge variant={m.tipo === 'entrada' ? 'default' : 'secondary'}>{m.tipo === 'entrada' ? 'Entrada' : 'Saída'}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(Number(m.quantidade))}</TableCell>
                        <TableCell>{ORIGEM_LABEL[m.origem_tipo] || m.origem_tipo}</TableCell>
                        <TableCell>{m.created_by_user_id ? nomes[m.created_by_user_id] || '—' : '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {novoOpen && <NovoItemDialog onClose={() => setNovoOpen(false)} userId={user?.id} onDone={invalidate} />}
      {editItem && <EditarItemDialog item={editItem} onClose={() => setEditItem(null)} onDone={invalidate} />}
      {movOpen && (
        <MovimentoDialog tipo={movOpen} itens={itens.filter(i => i.ativo)} saldoCentro={saldoCentro}
          userId={user?.id} onClose={() => setMovOpen(null)} onDone={invalidate} />
      )}
    </div>
  );
}

function parseMinimo(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error('Estoque mínimo inválido.');
  return n;
}

function EditarItemDialog({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [descricao, setDescricao] = useState(item.descricao);
  const [minimo, setMinimo] = useState(item.estoque_minimo != null ? String(item.estoque_minimo) : '');
  const mut = useMutation({
    mutationFn: async () => {
      if (!descricao.trim()) throw new Error('Preencha a descrição.');
      const min = parseMinimo(minimo);
      const { data, error } = await withTimeout(supabase.from('estoque_consumo_itens')
        .update({ descricao: descricao.trim(), estoque_minimo: min }).eq('id', item.id).select('id'));
      if (error) throw error;
      if (!data?.length) throw new Error('Sem permissão para editar item.');
    },
    onSuccess: () => { toast({ title: 'Item atualizado!' }); onDone(); onClose(); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro ao editar item', description: e.message }),
  });
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar item — {item.codigo}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Descrição *</Label><Input value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
          <div className="space-y-1"><Label>Estoque mínimo</Label><Input type="number" min="0" step="any" placeholder="Sem mínimo" value={minimo} onChange={e => setMinimo(e.target.value)} />
            <p className="text-xs text-muted-foreground">Deixe vazio para não ter alerta.</p></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoItemDialog({ onClose, onDone, userId }: { onClose: () => void; onDone: () => void; userId?: string }) {
  const { toast } = useToast();
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [controlado, setControlado] = useState(false);
  const [buscaPeca, setBuscaPeca] = useState('');
  const [peca, setPeca] = useState<{ id: string; codigo: string; nome: string } | null>(null);
  const [minimo, setMinimo] = useState('');

  const { data: pecas = [] } = useQuery({
    queryKey: ['estoque-consumo-busca-peca', buscaPeca],
    enabled: controlado && buscaPeca.trim().length >= 2,
    queryFn: async () => {
      const q = buscaPeca.trim().replace(/[%,()]/g, '');
      const { data, error } = await supabase.from('pecas').select('id, codigo, nome')
        .eq('ativo', true).or(`codigo.ilike.%${q}%,nome.ilike.%${q}%`).limit(20);
      if (error) throw error;
      const ids = (data || []).map(p => p.id);
      let usados = new Set<string>();
      if (ids.length) {
        const { data: ex, error: e2 } = await supabase.from('estoque_consumo_itens').select('peca_id').in('peca_id', ids);
        if (e2) throw e2;
        usados = new Set((ex || []).map((r: any) => r.peca_id));
      }
      return (data || []).map(p => ({ ...p, jaCadastrado: usados.has(p.id) }));
    },
  });

  const selecionarPeca = (p: { id: string; codigo: string; nome: string }) => {
    setPeca(p); setCodigo(p.codigo); setDescricao(p.nome);
  };
  const limparPeca = () => { setPeca(null); setCodigo(''); setDescricao(''); };

  const mut = useMutation({
    mutationFn: async () => {
      if (!codigo.trim() || !descricao.trim()) throw new Error('Preencha código e descrição.');
      if (controlado && !peca) throw new Error('Selecione a peça do catálogo para o Item Controlado.');
      const min = parseMinimo(minimo);
      const { data, error } = await withTimeout(supabase.from('estoque_consumo_itens').insert({
        codigo: codigo.trim(), descricao: descricao.trim(), peca_id: controlado ? peca!.id : null, created_by_user_id: userId, estoque_minimo: min,
      }).select('id'));
      if (error) {
        if (error.code === '23505') {
          if (`${error.message} ${error.details ?? ''}`.includes('peca_id')) throw new Error('Essa peça já está cadastrada no Estoque Uso/Consumo.');
          throw new Error('Já existe um item com esse código.');
        }
        throw error;
      }
      if (!data?.length) throw new Error('Sem permissão para criar item.');
    },
    onSuccess: () => { toast({ title: 'Item criado!' }); onDone(); onClose(); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro ao criar item', description: e.message }),
  });

  const travado = controlado && !!peca;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo item</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Código *</Label><Input value={codigo} readOnly={travado} className={travado ? 'bg-muted' : ''} onChange={e => setCodigo(e.target.value)} /></div>
          <div className="space-y-1"><Label>Descrição *</Label><Input value={descricao} readOnly={travado} className={travado ? 'bg-muted' : ''} onChange={e => setDescricao(e.target.value)} /></div>
          <div className="space-y-1"><Label>Estoque mínimo</Label><Input type="number" min="0" step="any" placeholder="Opcional" value={minimo} onChange={e => setMinimo(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={!controlado ? 'default' : 'outline'} onClick={() => { if (controlado) { setControlado(false); limparPeca(); } }}>Item Uso/Consumo</Button>
            <Button type="button" size="sm" variant={controlado ? 'default' : 'outline'} onClick={() => setControlado(true)}>Item Controlado</Button>
          </div>
          {controlado && (
            <div className="space-y-2">
              <Label>Peça do catálogo *</Label>
              {peca ? (
                <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <span className="min-w-0 truncate text-sm">{peca.codigo} — {peca.nome}</span>
                  <Button size="sm" variant="ghost" onClick={limparPeca}>Trocar</Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Buscar por código ou nome (mín. 2 letras)" value={buscaPeca} onChange={e => setBuscaPeca(e.target.value)} />
                  <div className="max-h-48 overflow-auto rounded-md border">
                    {pecas.map(p => (
                      <button key={p.id} type="button" disabled={p.jaCadastrado}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                        onClick={() => selecionarPeca(p)}>
                        <span className="min-w-0 truncate">{p.codigo} — {p.nome}</span>
                        {p.jaCadastrado && <Badge variant="secondary">Já cadastrado</Badge>}
                      </button>
                    ))}
                    {buscaPeca.trim().length >= 2 && pecas.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhuma peça encontrada</p>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovimentoDialog({ tipo, itens, saldoCentro, userId, onClose, onDone }: {
  tipo: 'entrada' | 'saida'; itens: Item[]; saldoCentro: (id: string) => number; userId?: string; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [itemId, setItemId] = useState('');
  const [qtd, setQtd] = useState('');
  const [obs, setObs] = useState('');
  const saldo = itemId ? saldoCentro(itemId) : 0;

  const mut = useMutation({
    mutationFn: async () => {
      const q = Number(qtd.replace(',', '.'));
      if (!itemId) throw new Error('Selecione o item.');
      if (!q || q <= 0) throw new Error('Informe uma quantidade maior que zero.');
      if (tipo === 'saida' && q > saldo) throw new Error(`Saldo insuficiente no Centro de Serviços (disponível: ${fmt(saldo)}).`);
      const { data, error } = await withTimeout(supabase.from('estoque_consumo_movimentos').insert({
        item_id: itemId, tipo, quantidade: q, local: 'centro_servicos', tecnico_user_id: null,
        origem_tipo: 'ajuste', notes: obs.trim() || null, created_by_user_id: userId,
      }).select('id'));
      if (error) throw error;
      if (!data?.length) throw new Error('Sem permissão para registrar o movimento.');
    },
    onSuccess: () => { toast({ title: tipo === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!' }); onDone(); onClose(); },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro ao registrar', description: e.message }),
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tipo === 'entrada' ? 'Dar entrada' : 'Dar saída'} — Centro de Serviços</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Item *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
              <SelectContent>
                {itens.map(i => <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.descricao}</SelectItem>)}
              </SelectContent>
            </Select>
            {itemId && <p className="text-xs text-muted-foreground">Saldo atual: {fmt(saldo)}</p>}
          </div>
          <div className="space-y-1"><Label>Quantidade *</Label><Input inputMode="decimal" value={qtd} onChange={e => setQtd(e.target.value)} /></div>
          <div className="space-y-1"><Label>Observação</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
