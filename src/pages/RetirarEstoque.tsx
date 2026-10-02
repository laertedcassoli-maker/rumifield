import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { parseQuantidade, fmtQtd } from '@/lib/estoque-unidade';
import { Loader2, PackageMinus, Plus, Search, Shield, Trash2 } from 'lucide-react';

type Item = { id: string; codigo: string; descricao: string; unidade: string; controle_consumo: string };

function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Tempo esgotado. Verifique sua conexão.')), ms)),
  ]);
}
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export default function RetirarEstoque() {
  const { user } = useAuth();
  const { canDelete, isLoading: permLoading } = useMenuPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [qtdInput, setQtdInput] = useState<Record<string, string>>({});
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [motivoInput, setMotivoInput] = useState<Record<string, string>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['estoque-retirada-centro'],
    staleTime: 0,
    queryFn: async () => {
      const { data: itens, error } = await supabase.from('estoque_consumo_itens')
        .select('id, codigo, descricao, unidade, controle_consumo').eq('ativo', true).order('codigo');
      if (error) throw error;
      const saldo: Record<string, number> = {};
      for (let from = 0; ; from += 1000) {
        const { data: m, error: e2 } = await supabase.from('estoque_consumo_movimentos')
          .select('item_id, tipo, quantidade').eq('local', 'centro_servicos').range(from, from + 999);
        if (e2) throw e2;
        (m || []).forEach((r: any) => {
          saldo[r.item_id] = (saldo[r.item_id] ?? 0) + (r.tipo === 'entrada' ? 1 : -1) * Number(r.quantidade);
        });
        if (!m || m.length < 1000) break;
      }
      return { itens: (itens || []) as Item[], saldo };
    },
  });

  const disponiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (data?.itens || []).filter(i => (data!.saldo[i.id] ?? 0) > 0)
      .filter(i => !b || i.codigo.toLowerCase().includes(b) || i.descricao.toLowerCase().includes(b));
  }, [data, busca]);

  const byId = useMemo(() => new Map((data?.itens || []).map(i => [i.id, i])), [data]);

  // Chave da linha: itemId (Por uso) ou itemId|motivo (A granel — uma linha por motivo)
  const itemDaLinha = (k: string) => k.split('|')[0];
  const totalDoItem = (itemId: string, c: Record<string, number> = carrinho) =>
    Object.entries(c).filter(([k]) => itemDaLinha(k) === itemId).reduce((s, [, q]) => s + q, 0);

  const adicionar = (item: Item) => {
    let q: number;
    try { q = parseQuantidade(qtdInput[item.id] || '1', item.unidade); }
    catch (e: any) { return toast({ title: e.message, variant: 'destructive' }); }
    const saldo = data?.saldo[item.id] ?? 0;
    const total = totalDoItem(item.id) + q;
    if (total > saldo) return toast({ title: 'Saldo insuficiente', description: `Disponível no Centro de Serviços: ${fmtQtd(saldo, item.unidade)}.`, variant: 'destructive' });
    if (item.controle_consumo === 'a_granel') {
      const m = (motivoInput[item.id] || '').trim();
      if (m.length < 3 || m.length > 200) return toast({ title: 'Informe o motivo da retirada (3 a 200 caracteres).', variant: 'destructive' });
      const key = `${item.id}|${m}`;
      setMotivos(s => ({ ...s, [key]: m }));
      setMotivoInput(s => ({ ...s, [item.id]: '' }));
      setCarrinho(c => ({ ...c, [key]: (c[key] ?? 0) + q }));
      setQtdInput(s => ({ ...s, [item.id]: '' }));
      return;
    }
    setCarrinho(c => ({ ...c, [item.id]: total }));
    setQtdInput(s => ({ ...s, [item.id]: '' }));
  };

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sessão expirada.');
      const linhas = Object.entries(carrinho);
      if (!linhas.length) throw new Error('Carrinho vazio.');
      for (const [k] of linhas) {
        const id = itemDaLinha(k);
        if (totalDoItem(id) > (data?.saldo[id] ?? 0)) throw new Error(`Saldo insuficiente para ${byId.get(id)?.codigo}.`);
        if (byId.get(id)?.controle_consumo === 'a_granel' && (motivos[k] || '').trim().length < 3) throw new Error(`Informe o motivo para ${byId.get(id)?.codigo}.`);
      }
      for (const [lineKey, quantidade] of linhas) {
        const item_id = itemDaLinha(lineKey);
        const transacao_id = crypto.randomUUID();
        const granel = byId.get(item_id)?.controle_consumo === 'a_granel';
        const base = { item_id, quantidade, origem_tipo: 'carrinho', transacao_id, created_by_user_id: user.id };
        const { data: d1, error: e1 } = await withTimeout(supabase.from('estoque_consumo_movimentos').insert({
          ...base, tipo: 'saida', local: 'centro_servicos', tecnico_user_id: null, notes: granel ? motivos[lineKey].trim() : null,
        }).select('id'));
        if (e1) throw e1;
        if (!d1?.length) throw new Error('Saída não registrada (sem permissão?).');
        if (granel) { setCarrinho(c => { const n = { ...c }; delete n[lineKey]; return n; }); continue; }
        const { data: d2, error: e2 } = await withTimeout(supabase.from('estoque_consumo_movimentos').insert({
          ...base, tipo: 'entrada', local: 'tecnico', tecnico_user_id: user.id,
        }).select('id'));
        if (e2) throw new Error(`Saída de ${byId.get(item_id)?.codigo} gravada, mas a entrada no seu estoque falhou: ${e2.message}`);
        if (!d2?.length) throw new Error(`Saída de ${byId.get(item_id)?.codigo} gravada, mas a entrada no seu estoque não foi registrada.`);
        setCarrinho(c => { const n = { ...c }; delete n[lineKey]; return n; });
      }
    },
    onSuccess: () => {
      toast({ title: 'Retirada finalizada' });
      qc.invalidateQueries({ queryKey: ['estoque-consumo-movimentos'] });
      navigate('/estoque-uso-consumo');
    },
    onError: (e: any) => {
      toast({ title: 'Erro na retirada', description: e.message, variant: 'destructive' });
      qc.invalidateQueries({ queryKey: ['estoque-retirada-centro'] });
      qc.invalidateQueries({ queryKey: ['estoque-consumo-movimentos'] });
    },
  });

  if (permLoading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!canDelete('estoque_uso_consumo')) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Shield className="h-5 w-5" />Você não tem permissão para retirar estoque.</div>;
  }

  const linhas = Object.entries(carrinho);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <PackageMinus className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Retirar para o meu estoque</h1>
      </div>
      <p className="text-sm text-muted-foreground">Itens do Centro de Serviços vão para o seu estoque pessoal.</p>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por código ou descrição" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : disponiveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item com saldo no Centro de Serviços.</p>
            ) : disponiveis.map(i => {
              const saldo = data!.saldo[i.id] ?? 0;
              const noCarrinho = totalDoItem(i.id);
              return (
                <div key={i.id} className="flex flex-wrap items-center gap-2 border rounded-lg p-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{i.codigo} — {i.descricao}</p>
                    <p className="text-xs text-muted-foreground">Saldo: {fmtQtd(saldo, i.unidade)}{noCarrinho > 0 && ` · no carrinho: ${fmtQtd(noCarrinho, i.unidade)}`}{i.controle_consumo === 'a_granel' && ' · A granel'}</p>
                  </div>
                  <Input className="w-20" type="number" min="0" step="any" placeholder="1"
                    value={qtdInput[i.id] ?? ''} onChange={e => setQtdInput(s => ({ ...s, [i.id]: e.target.value }))} />
                  {i.controle_consumo === 'a_granel' && (
                    <Input className="w-full sm:w-56" maxLength={200} placeholder="Ex.: Instalação Fazenda X"
                      value={motivoInput[i.id] ?? ''} onChange={e => setMotivoInput(s => ({ ...s, [i.id]: e.target.value }))} />
                  )}
                  <Button size="sm" onClick={() => adicionar(i)}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-w-0 h-fit">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold">Carrinho</h2>
            {linhas.length === 0 ? <p className="text-sm text-muted-foreground">Vazio.</p> : linhas.map(([lk, q]) => { const id = itemDaLinha(lk); return (
              <div key={lk} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{byId.get(id)?.codigo} — {byId.get(id)?.descricao}</p>
                  {byId.get(id)?.controle_consumo === 'a_granel' && (
                    <p className="text-xs text-muted-foreground">Baixa direta — não vai para o seu estoque · {motivos[lk]}</p>
                  )}
                </div>
                <span className="font-semibold text-sm">{fmtQtd(q, byId.get(id)?.unidade)}</span>
                <Button size="icon" variant="ghost" onClick={() => setCarrinho(c => { const n = { ...c }; delete n[lk]; return n; })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ); })}
            <Button className="w-full" disabled={finalizar.isPending} onClick={() => finalizar.mutate()}>
              {finalizar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Finalizar retirada
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
