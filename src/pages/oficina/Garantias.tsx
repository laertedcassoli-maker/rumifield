import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, FileText, Check, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WarrantyRequest {
  id: string;
  motor_code: string;
  description: string | null;
  replacement_date: string;
  hours_used: number;
  status: 'pendente' | 'solicitada' | 'reposta';
  invoice_number: string | null;
  workshop_item_id: string | null;
  work_order_id: string | null;
  created_at: string;
  workshop_items?: {
    unique_code: string;
  } | null;
  work_orders?: {
    code: string;
  } | null;
}

const statusConfig = {
  pendente: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
  solicitada: { label: 'Solicitada', variant: 'default' as const, icon: FileText },
  reposta: { label: 'Reposta', variant: 'outline' as const, icon: Check },
};

export default function Garantias() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('pendente');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WarrantyRequest | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Fetch warranty requests
  const { data: warrantyRequests = [], isLoading } = useQuery({
    queryKey: ['warranty-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warranty_requests' as never)
        .select(`
          *,
          workshop_items:workshop_item_id (unique_code),
          work_orders:work_order_id (code)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as WarrantyRequest[];
    },
  });

  // Fetch warranty hours config
  const { data: warrantyHoursConfig } = useQuery({
    queryKey: ['warranty-hours-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'garantia_motor_horas')
        .maybeSingle();
      if (error) throw error;
      return data?.valor ? parseInt(data.valor) : 400;
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, invoice }: { id: string; status: string; invoice?: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (invoice) updateData.invoice_number = invoice;
      
      const { error } = await supabase
        .from('warranty_requests' as never)
        .update(updateData as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranty-requests'] });
      setDetailDialogOpen(false);
      setSelectedRequest(null);
      setInvoiceNumber('');
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const filteredRequests = warrantyRequests.filter(r => r.status === activeTab);

  const openDetail = (request: WarrantyRequest) => {
    setSelectedRequest(request);
    setInvoiceNumber(request.invoice_number || '');
    setDetailDialogOpen(true);
  };

  const handleStatusChange = (newStatus: 'solicitada' | 'reposta') => {
    if (!selectedRequest) return;
    
    if (newStatus === 'reposta' && !invoiceNumber.trim()) {
      toast.error('Informe o número da invoice para marcar como reposta');
      return;
    }
    
    updateStatusMutation.mutate({
      id: selectedRequest.id,
      status: newStatus,
      invoice: newStatus === 'reposta' ? invoiceNumber : undefined,
    });
  };

  const countByStatus = {
    pendente: warrantyRequests.filter(r => r.status === 'pendente').length,
    solicitada: warrantyRequests.filter(r => r.status === 'solicitada').length,
    reposta: warrantyRequests.filter(r => r.status === 'reposta').length,
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Solicitações de Garantia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Motores com menos de {warrantyHoursConfig || 400}h de uso
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="pendente" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendentes ({countByStatus.pendente})
          </TabsTrigger>
          <TabsTrigger value="solicitada" className="gap-2">
            <FileText className="h-4 w-4" />
            Solicitadas ({countByStatus.solicitada})
          </TabsTrigger>
          <TabsTrigger value="reposta" className="gap-2">
            <Check className="h-4 w-4" />
            Repostas ({countByStatus.reposta})
          </TabsTrigger>
        </TabsList>

        {(['pendente', 'solicitada', 'reposta'] as const).map(status => (
          <TabsContent key={status} value={status}>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma solicitação {statusConfig[status].label.toLowerCase()}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map(request => {
                  const StatusIcon = statusConfig[request.status].icon;
                  return (
                    <Card 
                      key={request.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(request)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold">{request.motor_code}</span>
                              <Badge variant={statusConfig[request.status].variant}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig[request.status].label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {request.hours_used.toFixed(0)}h de uso • Troca em {format(new Date(request.replacement_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            {request.workshop_items?.unique_code && (
                              <p className="text-xs text-muted-foreground">
                                Ativo: {request.workshop_items.unique_code}
                              </p>
                            )}
                          </div>
                          {request.invoice_number && (
                            <Badge variant="outline" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {request.invoice_number}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Solicitação de Garantia
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Código do Motor</Label>
                  <p className="font-mono font-semibold">{selectedRequest.motor_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Horas de Uso</Label>
                  <p className="font-mono">{selectedRequest.hours_used.toFixed(0)}h</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Data da Troca</Label>
                  <p>{format(new Date(selectedRequest.replacement_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Badge variant={statusConfig[selectedRequest.status].variant}>
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
              </div>

              {selectedRequest.workshop_items?.unique_code && (
                <div>
                  <Label className="text-muted-foreground text-xs">Ativo</Label>
                  <p className="font-mono">{selectedRequest.workshop_items.unique_code}</p>
                </div>
              )}

              {selectedRequest.work_orders?.code && (
                <div>
                  <Label className="text-muted-foreground text-xs">Ordem de Serviço</Label>
                  <p className="font-mono">{selectedRequest.work_orders.code}</p>
                </div>
              )}

              {selectedRequest.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Descrição</Label>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}

              {/* Invoice input for reposta status */}
              {isAdmin && selectedRequest.status !== 'reposta' && (
                <div className="pt-2 border-t">
                  {selectedRequest.status === 'solicitada' && (
                    <div className="space-y-2">
                      <Label>Número da Invoice</Label>
                      <Input
                        placeholder="Ex: INV-2024-0001"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedRequest.invoice_number && (
                <div>
                  <Label className="text-muted-foreground text-xs">Invoice de Reposição</Label>
                  <p className="font-mono">{selectedRequest.invoice_number}</p>
                </div>
              )}
            </div>
          )}

          {isAdmin && selectedRequest && selectedRequest.status !== 'reposta' && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                Fechar
              </Button>
              {selectedRequest.status === 'pendente' && (
                <Button
                  onClick={() => handleStatusChange('solicitada')}
                  disabled={updateStatusMutation.isPending}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Marcar como Solicitada
                </Button>
              )}
              {selectedRequest.status === 'solicitada' && (
                <Button
                  onClick={() => handleStatusChange('reposta')}
                  disabled={updateStatusMutation.isPending || !invoiceNumber.trim()}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Marcar como Reposta
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
