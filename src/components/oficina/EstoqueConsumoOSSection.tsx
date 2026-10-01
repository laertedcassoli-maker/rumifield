import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Box, Loader2, Plus, Search } from 'lucide-react';

function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

type Item = { id: string; codigo: string; descricao: string };

export function EstoqueConsumoOSSection({ workOrderId, readOnly }: { workOrderId: string; readOnly: boolean }) {
  const { user } = useAuth();
  const { canDelete, isLoading: permLoading } = useMenuPermissions();
  const podeConsumir = !permLoading && canDelete('estoque_uso_consumo') && !readOnly;
  const [open, setOpen] = useState(false);

  const { data: consumidos = [] } = useQuery({
    queryKey: ['os-estoque-consumo', workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('estoque_consumo_movimentos')
        .select('id, quantidade, created_at, item:estoque_consumo_itens(codigo, descricao)')
        .eq('origem_tipo', 'os').eq('origem_id', workOrderId).eq('tipo', 'saida')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="p-3 border rounded-lg bg-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Box className="h-4 w-4" /> Estoque Uso/Consumo
          {consumidos.length > 0 && <Badge variant="secondary" className="text-xs font-mono">{consumidos.length}</Badge>}
        </p>
        {podeConsumir && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Consumir Estoque Uso/Consumo
          </Button>
        )}
      </div>
      {consumidos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item consumido nesta OS.</p>
      ) : (
        <ul className="space-y-1">
          {consumidos.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{m.item?.codigo} — {m.item?.descricao}</span>
              <span className="shrink-0 text-muted-foreground">{fmt(Number(m.quantidade))} · {format(new Date(m.created_at), 'dd/MM HH:mm')}</span>
            </li>
          ))}
        </ul>
      )}
      {open && <ConsumirDialog workOrderId={workOrderId} userId={user?.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ConsumirDialog({ workOrderId, userId, onClose }: { workOrderId: string; userId?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [item, setItem] = useState<Item | null>(null);
  const [qtd, setQtd] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['os-estoque-consumo-disponiveis'],
    queryFn: async () => {
      const [{ data: itens, error: e1 }, { data: movs, error: e2 }] = await Promise.all([
        supabase.from('estoque_consumo_itens').select('id, codigo, descricao').eq('ativo', true).order('codigo'),
        supabase.from('estoque_consumo_movimentos').select('item_id, tipo, quantidade').eq('local', 'centro_servicos'),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      const saldo = new Map<string, number>();
      (movs ?? []).forEach(m => saldo.set(m.item_id, (saldo.get(m.item_id) ?? 0) + (m.tipo === 'entrada' ? 1 : -1) * Number(m.quantidade)));
      return { itens: (itens ?? []).filter(i => (saldo.get(i.id) ?? 0) > 0) as Item[], saldo };
    },
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.itens ?? []).filter(i => !q || i.codigo.toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q));
  }, [data, busca]);
  const saldo = item ? data?.saldo.get(item.id) ?? 0 : 0;

  const mut = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('Selecione um item.');
      const q = Number(qtd.replace(',', '.'));
      if (!Number.isFinite(q) || q <= 0) throw new Error('Informe uma quantidade maior que zero.');
      // Revalida saldo atual no banco
      const { data: movs, error: e } = await withTimeout(supabase.from('estoque_consumo_movimentos')
        .select('tipo, quantidade').eq('item_id', item.id).eq('local', 'centro_servicos'));
      if (e) throw e;
      const atual = (movs ?? []).reduce((s, m) => s + (m.tipo === 'entrada' ? 1 : -1) * Number(m.quantidade), 0);
      if (q > atual) throw new Error(`Saldo insuficiente no Centro de Serviços (disponível: ${fmt(atual)}).`);
      const { data: ins, error } = await withTimeout(supabase.from('estoque_consumo_movimentos').insert({
        item_id: item.id, tipo: 'saida', quantidade: q, local: 'centro_servicos', tecnico_user_id: null,
        origem_tipo: 'os', origem_id: workOrderId, created_by_user_id: userId,
      }).select('id'));
      if (error) throw error;
      if (!ins?.length) throw new Error('Sem permissão para dar saída.');
    },
    onSuccess: () => {
      toast.success('Consumo registrado');
      qc.invalidateQueries({ queryKey: ['os-estoque-consumo', workOrderId] });
      qc.invalidateQueries({ queryKey: ['os-estoque-consumo-disponiveis'] });
      qc.invalidateQueries({ queryKey: ['estoque-consumo-movimentos'] });
      onClose();
    },
    onError: (e: Error) => toast.error('Erro ao consumir', { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Consumir Estoque Uso/Consumo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {item ? (
            <div className="flex items-center justify-between gap-2 rounded-md border p-2">
              <span className="min-w-0 truncate text-sm">{item.codigo} — {item.descricao}</span>
              <Button size="sm" variant="ghost" onClick={() => setItem(null)}>Trocar</Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar por código ou descrição" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              <div className="max-h-56 overflow-auto rounded-md border">
                {isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando...</p>}
                {lista.map(i => (
                  <button key={i.id} type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setItem(i)}>
                    <span className="min-w-0 truncate">{i.codigo} — {i.descricao}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">Saldo {fmt(data?.saldo.get(i.id) ?? 0)}</span>
                  </button>
                ))}
                {!isLoading && lista.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum item com saldo no Centro de Serviços</p>}
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Quantidade *</Label>
            <Input type="number" min="0" step="any" value={qtd} onChange={e => setQtd(e.target.value)} />
            {item && <p className="text-xs text-muted-foreground">Saldo atual: {fmt(saldo)}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Consumir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
