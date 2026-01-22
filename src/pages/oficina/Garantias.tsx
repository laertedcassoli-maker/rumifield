import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, FileText, Check, Clock, Package, Plus, Download, Wrench, ChevronRight, User } from 'lucide-react';
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
  user_id: string;
  workshop_items?: {
    unique_code: string;
  } | null;
  work_orders?: {
    code: string;
  } | null;
  profiles?: {
    nome: string;
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
          work_orders:work_order_id (code),
          profiles:user_id (nome)
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
          work_orders:work_order_id (code),
          profiles:user_id (nome)
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

  const generatePDF = () => {
    if (!selectedBatch) return;
    
    const reportContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Requisição de Garantia ${selectedBatch.batch_number}</title>
          <style>
            @page { margin: 15mm; size: A4; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; color: #333; font-size: 11px; }
            .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { font-size: 20px; color: #1e3a5f; margin: 0 0 5px 0; }
            .header .subtitle { color: #666; font-size: 12px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .info-item { background: #f8f9fa; padding: 10px; border-radius: 4px; }
            .info-item label { font-size: 10px; color: #666; text-transform: uppercase; display: block; margin-bottom: 3px; }
            .info-item span { font-weight: 600; font-size: 13px; }
            .status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
            .status-aberta { background: #fef3cd; color: #856404; }
            .status-finalizada { background: #d4edda; color: #155724; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #1e3a5f; color: white; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
            td { border-bottom: 1px solid #e0e0e0; padding: 10px 8px; font-size: 11px; }
            tr:nth-child(even) { background: #f8f9fa; }
            .mono { font-family: 'Consolas', monospace; }
            .text-right { text-align: right; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #666; display: flex; justify-content: space-between; }
            .summary { background: #1e3a5f; color: white; padding: 12px; border-radius: 4px; margin-top: 20px; display: flex; justify-content: space-between; }
            .summary-item { text-align: center; }
            .summary-item .value { font-size: 18px; font-weight: bold; }
            .summary-item .label { font-size: 10px; opacity: 0.8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Requisição de Garantia</h1>
            <div class="subtitle">${selectedBatch.batch_number}</div>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <label>Data da Requisição</label>
              <span>${format(new Date(selectedBatch.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            <div class="info-item">
              <label>Status</label>
              <span class="status-badge status-${selectedBatch.status}">${statusConfig[selectedBatch.status].label}</span>
            </div>
            ${selectedBatch.supplier_invoice ? `
            <div class="info-item">
              <label>Invoice Fornecedor</label>
              <span class="mono">${selectedBatch.supplier_invoice}</span>
            </div>
            ` : ''}
            ${selectedBatch.finalized_at ? `
            <div class="info-item">
              <label>Data Finalização</label>
              <span>${format(new Date(selectedBatch.finalized_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
            ` : ''}
          </div>
          
          ${selectedBatch.notes ? `
          <div class="info-item" style="margin-bottom: 20px;">
            <label>Observações</label>
            <span>${selectedBatch.notes}</span>
          </div>
          ` : ''}
          
          <h3 style="font-size: 14px; color: #1e3a5f; margin-bottom: 10px;">Motores Incluídos</h3>
          
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Código Motor</th>
                <th>Ativo</th>
                <th>Data Troca</th>
                <th class="text-right">Horas Uso</th>
                <th>Técnico</th>
              </tr>
            </thead>
            <tbody>
              ${batchMotors.map((motor, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="mono">${motor.old_motor_code || '-'}</td>
                  <td class="mono">${motor.workshop_items?.unique_code || '-'}</td>
                  <td>${format(new Date(motor.replaced_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                  <td class="text-right mono">${motor.motor_hours_used.toFixed(0)}h</td>
                  <td>${motor.profiles?.nome || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <div class="summary-item">
              <div class="value">${batchMotors.length}</div>
              <div class="label">Total de Motores</div>
            </div>
            <div class="summary-item">
              <div class="value">${batchMotors.reduce((sum, m) => sum + m.motor_hours_used, 0).toFixed(0)}h</div>
              <div class="label">Horas Totais</div>
            </div>
            <div class="summary-item">
              <div class="value">${(batchMotors.reduce((sum, m) => sum + m.motor_hours_used, 0) / Math.max(batchMotors.length, 1)).toFixed(0)}h</div>
              <div class="label">Média por Motor</div>
            </div>
          </div>
          
          <div class="footer">
            <span>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            <span>RumiField - Sistema de Gestão</span>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
      // Give time for styles to load, then trigger print (user can save as PDF)
      setTimeout(() => {
        printWindow.print();
      }, 250);
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
                          {motor.profiles?.nome && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {motor.profiles.nome}
                            </p>
                          )}
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
                        <TableHead>Técnico</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchMotors.map(motor => (
                        <TableRow key={motor.id}>
                          <TableCell className="font-mono">{motor.old_motor_code || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{motor.workshop_items?.unique_code || '-'}</TableCell>
                          <TableCell>{format(new Date(motor.replaced_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell className="text-right font-mono">{motor.motor_hours_used.toFixed(0)}h</TableCell>
                          <TableCell className="text-xs">{motor.profiles?.nome || '-'}</TableCell>
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
            <Button variant="outline" onClick={generatePDF}>
              <Download className="h-4 w-4 mr-2" />
              Gerar PDF
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
