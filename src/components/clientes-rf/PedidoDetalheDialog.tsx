import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const TIPO_LABELS: Record<string, string> = {
  envio: 'Envio',
  coleta_reversa: 'Coleta Reversa',
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  solicitado: 'Solicitado',
  processamento: 'Em processamento',
  faturado: 'Faturado',
  enviado: 'Enviado',
  entregue: 'Entregue',
  pendente: 'Pendente',
};

/** Faturado em verde (mesma paleta de "Resolvido" nos chamados); demais neutros. */
const STATUS_BADGE_CLASSES: Record<string, string> = {
  faturado: 'bg-green-500/10 text-green-600 border-green-500/20',
};

interface PedidoDetalheDialogProps {
  pedidoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatarData(data: string | null) {
  if (!data) return '—';
  return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function PedidoDetalheDialog({ pedidoId, open, onOpenChange }: PedidoDetalheDialogProps) {
  const { data: pedido, isLoading } = useQuery({
    queryKey: ['clientes-rf-pedido-detalhe', pedidoId],
    queryFn: async () => {
      if (!pedidoId) return null;
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id, pedido_code, status, tipo_solicitacao, created_at, updated_at,
          omie_data_faturamento, quantidade_volumes, codigo_rastreio,
          codigo_postagem, motivo_relato, observacoes,
          pedido_itens(quantidade, asset_codes, pecas(nome, codigo))
        `)
        .eq('id', pedidoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!pedidoId,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['clientes-rf-pedido-historico', pedidoId],
    queryFn: async () => {
      if (!pedidoId) return [];
      const { data, error } = await supabase
        .from('pedido_status_history')
        .select('id, status, changed_at')
        .eq('pedido_id', pedidoId)
        .order('changed_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!pedidoId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Package className="h-5 w-5 shrink-0" />
            Detalhes da solicitação
            {pedido?.pedido_code && (
              <span className="font-mono text-sm font-normal text-muted-foreground">
                {pedido.pedido_code}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>Informações da solicitação de peças.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-16 w-full" />)}
          </div>
        ) : !pedido ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Solicitação não encontrada.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{STATUS_LABELS[pedido.status] ?? pedido.status}</Badge>
              <Badge variant="secondary">
                {TIPO_LABELS[pedido.tipo_solicitacao] ?? pedido.tipo_solicitacao}
              </Badge>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Criado em</dt><dd className="font-medium">{formatarData(pedido.created_at)}</dd></div>
              <div><dt className="text-muted-foreground">Atualizado em</dt><dd className="font-medium">{formatarData(pedido.updated_at)}</dd></div>
              {pedido.omie_data_faturamento && (
                <div><dt className="text-muted-foreground">Faturado em</dt><dd className="font-medium">{formatarData(pedido.omie_data_faturamento)}</dd></div>
              )}
              <div><dt className="text-muted-foreground">Quantidade de volumes</dt><dd className="font-medium">{pedido.quantidade_volumes ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">Código de rastreio</dt><dd className="font-medium break-all">{pedido.codigo_rastreio || '—'}</dd></div>
              <div><dt className="text-muted-foreground">Código de postagem</dt><dd className="font-medium break-all">{pedido.codigo_postagem || '—'}</dd></div>
            </dl>

            <div className="space-y-1">
              <h3 className="text-sm font-medium">Motivo/relato</h3>
              <p className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
                {pedido.motivo_relato || 'Não informado'}
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-medium">Observações</h3>
              <p className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
                {pedido.observacoes || 'Não informadas'}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Itens</h3>
              {pedido.pedido_itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item registrado.</p>
              ) : (
                <div className="space-y-2">
                  {pedido.pedido_itens.map((item, index) => (
                    <div key={`${item.pecas?.codigo ?? 'item'}-${index}`} className="flex items-start justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words">{item.pecas?.nome || 'Peça não informada'}</p>
                        <p className="text-xs font-mono text-muted-foreground break-all">{item.pecas?.codigo || 'Sem código'}</p>
                        {item.asset_codes && item.asset_codes.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground break-words">Ativos: {item.asset_codes.join(', ')}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold">x{item.quantidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}