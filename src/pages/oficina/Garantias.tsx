import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, FileText, Check, Clock, Package, Plus, Printer, Wrench, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WarrantyBatch {
  id: string;
  batch_number: string;
  status: 'aberta' | 'finalizada';
  supplier_invoice: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  finalized_at: string | null;
  motors?: MotorReplacement[];
}

interface MotorReplacement {
  id: string;
  old_motor_code: string | null;
  motor_hours_used: number;
  replaced_at: string;
  warranty_batch_id: string | null;
  workshop_items?: {
    unique_code: string;
  } | null;
  work_orders?: {
    code: string;
  } | null;
}

const statusConfig = {
  aberta: { label: 'Aberta', variant: 'secondary' as const, icon: Clock },
  finalizada: { label: 'Finalizada', variant: 'default' as const, icon: Check },
};

export default function Garantias() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'coordenador_servicos';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<WarrantyBatch | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [batchNotes, setBatchNotes] = useState('');

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

  // Fetch motors pending warranty (not in any batch)
  const { data: pendingMotors = [], isLoading: loadingPending } = useQuery({
    queryKey: ['pending-warranty-motors'],
    queryFn: async () => {
      const warrantyLimit = warrantyHoursConfig || 400;
      const { data, error } = await supabase
        .from('motor_replacement_history')
        .select(`
          *,
          workshop_items:workshop_item_id (unique_code),
          work_orders:work_order_id (code)
        `)
        .is('warranty_batch_id', null)
        .lte('motor_hours_used', warrantyLimit)
        .order('replaced_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MotorReplacement[];
    },
    enabled: warrantyHoursConfig !== undefined,
  });

  // Fetch warranty batches
  const { data: batches = [], isLoading: loadingBatches } = useQuery({
    queryKey: ['warranty-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warranty_batches' as never)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as WarrantyBatch[];
    },
  });

  // Fetch motors for a specific batch
  const { data: batchMotors = [] } = useQuery({
    queryKey: ['batch-motors', selectedBatch?.id],
    queryFn: async () => {
      if (!selectedBatch) return [];
      const { data, error } = await supabase
        .from('motor_replacement_history')
        .select(`
          *,
          workshop_items:workshop_item_id (unique_code),
          work_orders:work_order_id (code)
        `)
        .eq('warranty_batch_id' as never, selectedBatch.id)
        .order('replaced_at', { ascending: false });
      if (error) throw error;
      return data as unknown as MotorReplacement[];
    },
    enabled: !!selectedBatch,
  });

  // Create warranty batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');
      
      // Generate batch number
      const { data: batchNumberData, error: batchNumberError } = await supabase
        .rpc('generate_warranty_batch_number' as never);
      if (batchNumberError) throw batchNumberError;
      
      const batchNumber = batchNumberData as string;
      
      // Create batch
      const { data: newBatch, error: createError } = await supabase
        .from('warranty_batches' as never)
        .insert({
          batch_number: batchNumber,
          created_by_user_id: user.id,
          notes: batchNotes || null,
        } as never)
        .select()
        .single();
      if (createError) throw createError;

      // Associate all pending motors to this batch
      const warrantyLimit = warrantyHoursConfig || 400;
      const { error: updateError } = await supabase
        .from('motor_replacement_history')
        .update({ warranty_batch_id: (newBatch as WarrantyBatch).id } as never)
        .is('warranty_batch_id', null)
        .lte('motor_hours_used', warrantyLimit);
      if (updateError) throw updateError;

      return newBatch as WarrantyBatch;
    },
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ['warranty-batches'] });
      queryClient.invalidateQueries({ queryKey: ['pending-warranty-motors'] });
      setCreateDialogOpen(false);
      setBatchNotes('');
      toast.success(`Requisição ${newBatch.batch_number} criada com ${pendingMotors.length} motores!`);
    },
    onError: (error) => {
      toast.error('Erro ao criar requisição: ' + error.message);
    },
  });

  // Finalize batch mutation
  const finalizeBatchMutation = useMutation({
    mutationFn: async ({ id, invoice }: { id: string; invoice: string }) => {
      const { error } = await supabase
        .from('warranty_batches' as never)
        .update({ 
          status: 'finalizada',
          supplier_invoice: invoice,
          finalized_at: new Date().toISOString()
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranty-batches'] });
      setDetailDialogOpen(false);
      setSelectedBatch(null);
      setInvoiceNumber('');
      toast.success('Requisição finalizada!');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const openBatches = batches.filter(b => b.status === 'aberta');
  const finalizedBatches = batches.filter(b => b.status === 'finalizada');

  const openDetail = (batch: WarrantyBatch) => {
    setSelectedBatch(batch);
    setInvoiceNumber(batch.supplier_invoice || '');
    setDetailDialogOpen(true);
  };

  const handleFinalize = () => {
    if (!selectedBatch) return;
    if (!invoiceNumber.trim()) {
      toast.error('Informe o número da invoice do fornecedor');
      return;
    }
    finalizeBatchMutation.mutate({ id: selectedBatch.id, invoice: invoiceNumber });
  };

  const printReport = () => {
    if (!selectedBatch) return;
    
    const reportContent = `
      <html>
        <head>
          <title>Requisição de Garantia ${selectedBatch.batch_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            .info { margin-bottom: 15px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Requisição de Garantia: ${selectedBatch.batch_number}</h1>
          <div class="info">
            <p><strong>Data:</strong> ${format(new Date(selectedBatch.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
            <p><strong>Status:</strong> ${statusConfig[selectedBatch.status].label}</p>
            ${selectedBatch.supplier_invoice ? `<p><strong>Invoice:</strong> ${selectedBatch.supplier_invoice}</p>` : ''}
            ${selectedBatch.notes ? `<p><strong>Observações:</strong> ${selectedBatch.notes}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Código Motor</th>
                <th>Ativo</th>
                <th>Data Troca</th>
                <th>Horas Uso</th>
              </tr>
            </thead>
            <tbody>
              ${batchMotors.map((motor, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${motor.old_motor_code || '-'}</td>
                  <td>${motor.workshop_items?.unique_code || '-'}</td>
                  <td>${format(new Date(motor.replaced_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                  <td>${motor.motor_hours_used.toFixed(0)}h</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Total de motores: ${batchMotors.length}</p>
            <p>Impresso em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Requisições de Garantia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Motores com menos de {warrantyHoursConfig || 400}h de uso
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Wrench className="h-4 w-4" />
            Pendentes ({pendingMotors.length})
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-2">
            <Clock className="h-4 w-4" />
            Abertas ({openBatches.length})
          </TabsTrigger>
          <TabsTrigger value="finalized" className="gap-2">
            <Check className="h-4 w-4" />
            Finalizadas ({finalizedBatches.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Motors Tab */}
        <TabsContent value="pending">
          {loadingPending ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : pendingMotors.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum motor pendente de requisição de garantia
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{pendingMotors.length} motores pendentes</p>
                      <p className="text-sm text-muted-foreground">
                        Crie uma requisição para incluir todos
                      </p>
                    </div>
                    <Button onClick={() => setCreateDialogOpen(true)} disabled={pendingMotors.length === 0}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Requisição
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                {pendingMotors.map(motor => (
                  <Card key={motor.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{motor.old_motor_code || '(sem código)'}</span>
                            <Badge variant="secondary" className="text-xs">
                              {motor.motor_hours_used.toFixed(0)}h
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Troca: {format(new Date(motor.replaced_at), "dd/MM/yyyy", { locale: ptBR })}
                            {motor.workshop_items?.unique_code && ` • Ativo: ${motor.workshop_items.unique_code}`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Open Batches Tab */}
        <TabsContent value="open">
          {loadingBatches ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : openBatches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma requisição aberta
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {openBatches.map(batch => (
                <Card 
                  key={batch.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(batch)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{batch.batch_number}</span>
                          <Badge variant={statusConfig[batch.status].variant}>
                            <Clock className="h-3 w-3 mr-1" />
                            {statusConfig[batch.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Criada em {format(new Date(batch.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Finalized Batches Tab */}
        <TabsContent value="finalized">
          {loadingBatches ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : finalizedBatches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma requisição finalizada
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {finalizedBatches.map(batch => (
                <Card 
                  key={batch.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openDetail(batch)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{batch.batch_number}</span>
                          <Badge variant={statusConfig[batch.status].variant}>
                            <Check className="h-3 w-3 mr-1" />
                            {statusConfig[batch.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Finalizada em {batch.finalized_at ? format(new Date(batch.finalized_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {batch.supplier_invoice && (
                          <Badge variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {batch.supplier_invoice}
                          </Badge>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Batch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Requisição de Garantia
            </DialogTitle>
            <DialogDescription>
              Será criada uma requisição com todos os {pendingMotors.length} motores pendentes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Motores a incluir:</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {pendingMotors.map(motor => (
                  <div key={motor.id} className="text-xs flex items-center justify-between">
                    <span className="font-mono">{motor.old_motor_code || '(sem código)'}</span>
                    <span className="text-muted-foreground">{motor.motor_hours_used.toFixed(0)}h</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Observações sobre esta requisição..."
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createBatchMutation.mutate()}
              disabled={createBatchMutation.isPending || pendingMotors.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Requisição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Requisição {selectedBatch?.batch_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Número</Label>
                  <p className="font-mono font-semibold">{selectedBatch.batch_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Badge variant={statusConfig[selectedBatch.status].variant}>
                    {statusConfig[selectedBatch.status].label}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Data Criação</Label>
                  <p>{format(new Date(selectedBatch.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
                {selectedBatch.finalized_at && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Data Finalização</Label>
                    <p>{format(new Date(selectedBatch.finalized_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                )}
              </div>

              {selectedBatch.supplier_invoice && (
                <div>
                  <Label className="text-muted-foreground text-xs">Invoice Fornecedor</Label>
                  <p className="font-mono">{selectedBatch.supplier_invoice}</p>
                </div>
              )}

              {selectedBatch.notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p className="text-sm">{selectedBatch.notes}</p>
                </div>
              )}

              {/* Motors list */}
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">
                  Motores ({batchMotors.length})
                </Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código Motor</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Data Troca</TableHead>
                        <TableHead className="text-right">Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchMotors.map(motor => (
                        <TableRow key={motor.id}>
                          <TableCell className="font-mono">{motor.old_motor_code || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{motor.workshop_items?.unique_code || '-'}</TableCell>
                          <TableCell>{format(new Date(motor.replaced_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell className="text-right font-mono">{motor.motor_hours_used.toFixed(0)}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Invoice input for finalizing */}
              {isAdmin && selectedBatch.status === 'aberta' && (
                <div className="pt-2 border-t space-y-2">
                  <Label>Número da Invoice do Fornecedor</Label>
                  <Input
                    placeholder="Ex: INV-2024-0001"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={printReport}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Fechar
            </Button>
            {isAdmin && selectedBatch?.status === 'aberta' && (
              <Button
                onClick={handleFinalize}
                disabled={finalizeBatchMutation.isPending || !invoiceNumber.trim()}
              >
                <Check className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
