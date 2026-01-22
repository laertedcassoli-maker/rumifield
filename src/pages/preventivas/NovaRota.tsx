import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  ArrowLeft,
  Save,
  AlertTriangle,
  Clock,
  HelpCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const statusConfig = {
  sem_historico: { label: 'Sem Histórico', color: 'bg-muted text-muted-foreground', icon: HelpCircle, priority: 0 },
  atrasada: { label: 'Atrasada', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle, priority: 1 },
  elegivel: { label: 'Elegível', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock, priority: 2 },
  em_dia: { label: 'Em Dia', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle, priority: 3 },
};

interface ClientPreventive {
  client_id: string;
  client_name: string;
  fazenda: string | null;
  preventive_frequency_days: number | null;
  last_preventive_date: string | null;
  days_until_due: number | null;
  preventive_status: string;
  suggested_reason?: string;
}

export default function NovaRota() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    route_code: '',
    start_date: '',
    end_date: '',
    field_technician_user_id: '',
    notes: '',
  });
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const isAdminOrCoordinator = role === 'admin' || role === 'coordenador_servicos';

  // Fetch field technicians
  const { data: technicians } = useQuery({
    queryKey: ['field-technicians'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico_campo');
      
      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map(r => r.user_id));
      
      return profiles || [];
    },
  });

  // Fetch clients with preventive status
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients-for-route'],
    queryFn: async () => {
      const { data: clients, error: clientsError } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, preventive_frequency_days, status')
        .eq('status', 'ativo')
        .order('nome');
      
      if (clientsError) throw clientsError;

      const { data: preventives, error: preventivesError } = await supabase
        .from('preventive_maintenance')
        .select('client_id, completed_date')
        .eq('status', 'concluida');
      
      if (preventivesError) throw preventivesError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return clients?.map(client => {
        const clientPreventives = preventives?.filter(p => p.client_id === client.id) || [];
        const lastPreventive = clientPreventives.length > 0 
          ? clientPreventives.reduce((max, p) => 
              new Date(p.completed_date!) > new Date(max.completed_date!) ? p : max
            )
          : null;

        const lastPreventiveDate = lastPreventive?.completed_date 
          ? new Date(lastPreventive.completed_date) 
          : null;
        
        let daysUntilDue: number | null = null;
        let status = 'sem_historico';
        let suggestedReason = '';

        if (lastPreventiveDate) {
          const daysSinceLast = Math.floor((today.getTime() - lastPreventiveDate.getTime()) / (1000 * 60 * 60 * 24));
          const frequency = client.preventive_frequency_days || 90;
          daysUntilDue = frequency - daysSinceLast;

          if (daysUntilDue < 0) {
            status = 'atrasada';
            suggestedReason = `Atrasada há ${Math.abs(daysUntilDue)} dias`;
          } else if (daysUntilDue <= 30) {
            status = 'elegivel';
            suggestedReason = `Vence em ${daysUntilDue} dias`;
          } else {
            status = 'em_dia';
          }
        } else {
          suggestedReason = 'Nunca realizou preventiva';
        }

        return {
          client_id: client.id,
          client_name: client.nome,
          fazenda: client.fazenda,
          preventive_frequency_days: client.preventive_frequency_days,
          last_preventive_date: lastPreventive?.completed_date || null,
          days_until_due: daysUntilDue,
          preventive_status: status,
          suggested_reason: suggestedReason,
        } as ClientPreventive;
      }) || [];
    },
  });

  // Sort clients by priority (suggested first)
  const sortedClients = useMemo(() => {
    if (!clientsData) return [];
    
    return [...clientsData].sort((a, b) => {
      const aConfig = statusConfig[a.preventive_status as keyof typeof statusConfig];
      const bConfig = statusConfig[b.preventive_status as keyof typeof statusConfig];
      const priorityDiff = (aConfig?.priority ?? 99) - (bConfig?.priority ?? 99);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Within same priority, sort by days_until_due
      const aDays = a.days_until_due ?? -9999;
      const bDays = b.days_until_due ?? -9999;
      return aDays - bDays;
    });
  }, [clientsData]);

  // Suggested clients (sem_historico, atrasada, elegivel)
  const suggestedClients = useMemo(() => {
    return sortedClients.filter(c => 
      c.preventive_status === 'sem_historico' || 
      c.preventive_status === 'atrasada' || 
      c.preventive_status === 'elegivel'
    );
  }, [sortedClients]);

  const handleSelectSuggested = () => {
    const newSelected = new Set(selectedClients);
    suggestedClients.forEach(c => newSelected.add(c.client_id));
    setSelectedClients(newSelected);
  };

  const handleToggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === sortedClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(sortedClients.map(c => c.client_id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.route_code || !form.start_date || !form.end_date || !form.field_technician_user_id) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
      });
      return;
    }

    if (selectedClients.size === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione fazendas',
        description: 'Adicione pelo menos uma fazenda à rota.',
      });
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast({
        variant: 'destructive',
        title: 'Datas inválidas',
        description: 'A data final deve ser posterior à data inicial.',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Create route
      const { data: route, error: routeError } = await supabase
        .from('preventive_routes')
        .insert({
          route_code: form.route_code,
          start_date: form.start_date,
          end_date: form.end_date,
          field_technician_user_id: form.field_technician_user_id,
          notes: form.notes || null,
          created_by_user_id: user!.id,
          status: 'planejada',
        })
        .select()
        .single();

      if (routeError) throw routeError;

      // Create route items
      const items = Array.from(selectedClients).map(clientId => {
        const client = clientsData?.find(c => c.client_id === clientId);
        return {
          route_id: route.id,
          client_id: clientId,
          suggested_reason: client?.suggested_reason || null,
          status: 'planejado' as const,
        };
      });

      const { error: itemsError } = await supabase
        .from('preventive_route_items')
        .insert(items);

      if (itemsError) throw itemsError;

      toast({ title: 'Rota criada com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['preventive-routes'] });
      navigate('/preventivas/rotas');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar rota',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!isAdminOrCoordinator) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Você não tem permissão para criar rotas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/preventivas/rotas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Rota Preventiva</h1>
          <p className="text-muted-foreground">Programe uma nova rota de manutenção</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Route Details */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Rota</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Código da Rota *</Label>
              <Input
                placeholder="Ex: Rota Preventiva 01"
                value={form.route_code}
                onChange={(e) => setForm({ ...form, route_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Técnico de Campo *</Label>
              <Select
                value={form.field_technician_user_id}
                onValueChange={(v) => setForm({ ...form, field_technician_user_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {technicians?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas adicionais sobre a rota..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Client Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Seleção de Fazendas</CardTitle>
                <CardDescription>
                  {selectedClients.size} fazenda(s) selecionada(s)
                  {suggestedClients.length > 0 && (
                    <span className="text-warning ml-2">
                      ({suggestedClients.length} sugerida(s))
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {suggestedClients.length > 0 && (
                  <Button type="button" variant="outline" onClick={handleSelectSuggested}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Selecionar Sugeridas
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={handleSelectAll}>
                  {selectedClients.size === sortedClients.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[400px] overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedClients.map((client) => (
                      <TableRow 
                        key={client.client_id}
                        className={selectedClients.has(client.client_id) ? 'bg-primary/5' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedClients.has(client.client_id)}
                            onCheckedChange={() => handleToggleClient(client.client_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.client_name}</div>
                            {client.fazenda && (
                              <div className="text-sm text-muted-foreground">{client.fazenda}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.preventive_frequency_days ? `${client.preventive_frequency_days} dias` : '-'}
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(client.preventive_status)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {client.suggested_reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link to="/preventivas/rotas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Criar Rota
          </Button>
        </div>
      </form>
    </div>
  );
}
