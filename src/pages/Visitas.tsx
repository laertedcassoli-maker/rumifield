import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Plus, MapPin, Building2, Loader2, Search, 
  Navigation, CheckCircle2, X, Clock, ChevronRight 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cn } from '@/lib/utils';

interface Cliente {
  id: string;
  nome: string;
  fazenda: string | null;
  cidade: string | null;
  status: string;
}

interface Visita {
  id: string;
  data_visita: string;
  descricao: string | null;
  latitude: number | null;
  longitude: number | null;
  clientes: {
    nome: string;
    fazenda: string | null;
  } | null;
}

export default function Visitas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [descricao, setDescricao] = useState('');
  const [step, setStep] = useState<'cliente' | 'checkin' | 'descricao'>('cliente');
  
  const geo = useGeolocation();

  // Fetch only active clients
  const { data: clientes } = useQuery<Cliente[]>({
    queryKey: ['clientes-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade, status')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data as unknown as Cliente[];
    },
  });

  const { data: visitas, isLoading } = useQuery<Visita[]>({
    queryKey: ['visitas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas')
        .select('id, data_visita, descricao, latitude, longitude, clientes(nome, fazenda)')
        .order('data_visita', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as Visita[];
    },
  });

  const createVisita = useMutation({
    mutationFn: async (data: { 
      cliente_id: string; 
      descricao: string;
      latitude?: number;
      longitude?: number;
    }) => {
      const { error } = await supabase.from('visitas').insert({
        tecnico_id: user?.id,
        cliente_id: data.cliente_id,
        descricao: data.descricao,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      handleClose();
      toast({ title: 'Check-in realizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao registrar visita', description: error.message });
    },
  });

  const handleClose = () => {
    setSheetOpen(false);
    setStep('cliente');
    setSelectedCliente(null);
    setDescricao('');
    setClienteSearch('');
    geo.clearLocation();
  };

  const handleSelectCliente = (cliente: any) => {
    setSelectedCliente(cliente);
    setStep('checkin');
  };

  const handleCheckin = async () => {
    try {
      await geo.getLocation();
      setStep('descricao');
    } catch {
      // Even without location, allow to proceed
      setStep('descricao');
    }
  };

  const handleSkipLocation = () => {
    setStep('descricao');
  };

  const handleSubmit = () => {
    if (!selectedCliente) return;
    
    createVisita.mutate({
      cliente_id: selectedCliente.id,
      descricao,
      latitude: geo.latitude ?? undefined,
      longitude: geo.longitude ?? undefined,
    });
  };

  // Filter clients by search
  const filteredClientes = useMemo(() => {
    if (!clientes) return [];
    if (!clienteSearch.trim()) return clientes;
    
    const search = clienteSearch.toLowerCase();
    return clientes.filter(c => 
      c.nome?.toLowerCase().includes(search) ||
      c.fazenda?.toLowerCase().includes(search) ||
      c.cidade?.toLowerCase().includes(search)
    );
  }, [clientes, clienteSearch]);

  // Group visits by date
  const groupedVisitas = useMemo(() => {
    if (!visitas) return {} as Record<string, any[]>;
    
    const groups: Record<string, any[]> = {};
    visitas.forEach(v => {
      const date = new Date(v.data_visita);
      let key: string;
      
      if (isToday(date)) {
        key = 'Hoje';
      } else if (isYesterday(date)) {
        key = 'Ontem';
      } else {
        key = format(date, "dd 'de' MMMM", { locale: ptBR });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    
    return groups;
  }, [visitas]);

  const formatTime = (date: string) => {
    return format(new Date(date), 'HH:mm', { locale: ptBR });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header compacto */}
      <div>
        <h1 className="text-xl font-bold">Visitas</h1>
        <p className="text-sm text-muted-foreground">Histórico de check-ins</p>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visitas?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhuma visita registrada</h3>
            <p className="text-sm text-muted-foreground">Toque no botão + para fazer check-in</p>
          </CardContent>
        </Card>
      ) : (
        /* Lista agrupada por data */
        <div className="space-y-6">
          {Object.entries(groupedVisitas).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {dateLabel}
              </h3>
              <div className="space-y-2">
                {items.map((visita) => (
                  <Card key={visita.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 text-center">
                          <span className="text-lg font-semibold">{formatTime(visita.data_visita)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{visita.clientes?.nome}</p>
                          {visita.clientes?.fazenda && (
                            <p className="text-sm text-muted-foreground truncate">{visita.clientes.fazenda}</p>
                          )}
                          {visita.descricao && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{visita.descricao}</p>
                          )}
                        </div>
                        {(visita.latitude && visita.longitude) && (
                          <div className="flex-shrink-0">
                            <MapPin className="h-4 w-4 text-green-600" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB - Floating Action Button */}
      <Button
        size="lg"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 md:bottom-6"
        onClick={() => setSheetOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Sheet para nova visita - Mobile friendly */}
      <Sheet open={sheetOpen} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>
              {step === 'cliente' && 'Selecionar Cliente'}
              {step === 'checkin' && 'Confirmar Check-in'}
              {step === 'descricao' && 'Detalhes da Visita'}
            </SheetTitle>
          </SheetHeader>

          {/* Step 1: Selecionar cliente */}
          {step === 'cliente' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou fazenda..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              
              <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
                {filteredClientes.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => handleSelectCliente(cliente)}
                    className="w-full p-3 rounded-lg text-left hover:bg-muted active:bg-muted/80 transition-colors flex items-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cliente.nome}</p>
                      {cliente.fazenda && (
                        <p className="text-sm text-muted-foreground truncate">{cliente.fazenda}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
                
                {filteredClientes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Check-in com localização */}
          {step === 'checkin' && selectedCliente && (
            <div className="space-y-6">
              {/* Cliente selecionado */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{selectedCliente.nome}</p>
                      {selectedCliente.fazenda && (
                        <p className="text-sm text-muted-foreground">{selectedCliente.fazenda}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setStep('cliente')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Status da localização */}
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className={cn(
                    "mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 transition-colors",
                    geo.hasLocation ? "bg-green-100" : "bg-muted"
                  )}>
                    {geo.loading ? (
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    ) : geo.hasLocation ? (
                      <CheckCircle2 className="h-10 w-10 text-green-600" />
                    ) : (
                      <Navigation className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  
                  {geo.loading ? (
                    <p className="text-muted-foreground">Obtendo localização...</p>
                  ) : geo.hasLocation ? (
                    <>
                      <p className="font-medium text-green-600">Localização obtida!</p>
                      <p className="text-sm text-muted-foreground">
                        Precisão: ~{Math.round(geo.accuracy || 0)}m
                      </p>
                    </>
                  ) : geo.error ? (
                    <p className="text-sm text-destructive">{geo.error}</p>
                  ) : (
                    <p className="text-muted-foreground">Toque para registrar sua localização</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {!geo.hasLocation && (
                    <Button 
                      size="lg" 
                      onClick={handleCheckin}
                      disabled={geo.loading}
                      className="w-full"
                    >
                      {geo.loading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Navigation className="mr-2 h-5 w-5" />
                      )}
                      Obter Localização
                    </Button>
                  )}
                  
                  <Button 
                    size="lg" 
                    variant={geo.hasLocation ? "default" : "outline"}
                    onClick={() => setStep('descricao')}
                    className="w-full"
                  >
                    {geo.hasLocation ? 'Continuar' : 'Continuar sem localização'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Descrição */}
          {step === 'descricao' && selectedCliente && (
            <div className="space-y-4">
              {/* Resumo */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{selectedCliente.nome}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(), "dd/MM 'às' HH:mm")}</span>
                        {geo.hasLocation && (
                          <>
                            <span>•</span>
                            <MapPin className="h-3 w-3 text-green-600" />
                            <span className="text-green-600">Com localização</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Descreva o que foi realizado na visita..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>

              <Button 
                size="lg"
                onClick={handleSubmit}
                disabled={createVisita.isPending}
                className="w-full"
              >
                {createVisita.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Confirmar Check-in
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
