import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Loader2, 
  Check, 
  ChevronsUpDown,
  Building2,
  User,
  Package,
  Tag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  nome: string;
  fazenda: string | null;
  cidade: string | null;
}

interface Technician {
  id: string;
  nome: string;
}

interface TicketCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface TicketTag {
  id: string;
  name: string;
  color: string;
}

// Produtos fixos no código
const PRODUCTS = [
  { key: 'rumiflow', label: 'RumiFlow', color: 'bg-blue-500' },
  { key: 'rumiprocare', label: 'RumiProcare', color: 'bg-green-500' },
  { key: 'rumiaction', label: 'RumiAction', color: 'bg-orange-500' },
];

export default function NovoChamado() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('media');
  const [clientId, setClientId] = useState<string>('');
  const [technicianId, setTechnicianId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [shouldScheduleVisit, setShouldScheduleVisit] = useState(false);

  // Fetch active clients
  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['active-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, cidade')
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch field technicians
  const { data: technicians } = useQuery<Technician[]>({
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
        .in('id', roles.map(r => r.user_id))
        .order('nome');
      
      return profiles || [];
    },
  });

  // Fetch ticket categories
  const { data: categories } = useQuery<TicketCategory[]>({
    queryKey: ['ticket-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_categories')
        .select('id, name, color, icon')
        .eq('is_active', true)
        .order('order_index');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active ticket tags
  const { data: ticketTags } = useQuery<TicketTag[]>({
    queryKey: ['ticket-tags-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_tags')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_index')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Filter clients by search
  const filteredClients = clients?.filter(client => {
    if (!clientSearch) return true;
    const search = clientSearch.toLowerCase();
    return (
      client.nome.toLowerCase().includes(search) ||
      client.fazenda?.toLowerCase().includes(search) ||
      client.cidade?.toLowerCase().includes(search)
    );
  }) || [];

  const selectedClient = clients?.find(c => c.id === clientId);

  const toggleProduct = (productKey: string) => {
    setSelectedProducts(prev =>
      prev.includes(productKey)
        ? prev.filter(p => p !== productKey)
        : [...prev, productKey]
    );
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  // Create ticket mutation
  const createTicket = useMutation({
    mutationFn: async () => {
      // Generate ticket code
      const { data: ticketCode, error: codeError } = await supabase.rpc('generate_ticket_code');
      if (codeError) throw codeError;

      // Insert ticket
      const { data: ticket, error } = await supabase
        .from('technical_tickets')
        .insert({
          ticket_code: ticketCode,
          client_id: clientId,
          created_by_user_id: user!.id,
          assigned_technician_id: technicianId || null,
          title: description.trim().substring(0, 80),
          description: description || null,
          priority: priority as any,
          status: 'aberto',
          products: selectedProducts,
          category_id: categoryId || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Add timeline entry
      await supabase.from('ticket_timeline').insert({
        ticket_id: ticket.id,
        user_id: user!.id,
        event_type: 'ticket_created',
        event_description: `Chamado criado: ${ticketCode}`,
      });

      // Save tag links
      if (selectedTagIds.length > 0) {
        await supabase.from('ticket_tag_links').insert(
          selectedTagIds.map(tagId => ({ ticket_id: ticket.id, tag_id: tagId }))
        );
      }

      return ticket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['technical-tickets'] });
      toast({ title: 'Chamado criado com sucesso!' });
      navigate(`/chamados/${ticket.id}`, { 
        state: { openVisita: shouldScheduleVisit } 
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar chamado',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent, scheduleVisit = false) => {
    e.preventDefault();
    if (!clientId || !description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Selecione um cliente e preencha o relato da fazenda.',
      });
      return;
    }
    setShouldScheduleVisit(scheduleVisit);
    createTicket.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/chamados">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Novo Chamado</h1>
          <p className="text-muted-foreground">Registre um novo chamado técnico</p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        !clientId && "text-muted-foreground"
                      )}
                    >
                      {selectedClient ? (
                        <span className="truncate">
                          {selectedClient.nome}
                          {selectedClient.fazenda && ` - ${selectedClient.fazenda}`}
                        </span>
                      ) : (
                        "Selecione um cliente..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                     {/*
                      * cmdk filtra os itens pelo `value` do CommandItem.
                      * Como nós já filtramos manualmente (nome/fazenda/cidade), desativamos o filtro interno
                      * para evitar que a busca tente casar com o UUID.
                      */}
                     <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Buscar cliente..." 
                        value={clientSearch}
                        onValueChange={setClientSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {clientsLoading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredClients.slice(0, 50).map((client) => (
                            <CommandItem
                              key={client.id}
                               value={[client.nome, client.fazenda, client.cidade]
                                 .filter(Boolean)
                                 .join(' ')
                                 .toLowerCase()}
                              onSelect={() => {
                                setClientId(client.id);
                                setClientPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  clientId === client.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div>
                                <div className="font-medium">{client.nome}</div>
                                {(client.fazenda || client.cidade) && (
                                  <div className="text-sm text-muted-foreground">
                                    {[client.fazenda, client.cidade].filter(Boolean).join(' • ')}
                                  </div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Atribuição */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Atribuição
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Técnico de Campo</Label>
                <Select value={technicianId} onValueChange={setTechnicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um técnico (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.map(tech => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Produtos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Produtos relacionados</Label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCTS.map(product => (
                    <Button
                      key={product.key}
                      type="button"
                      variant={selectedProducts.includes(product.key) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleProduct(product.key)}
                      className={cn(
                        "transition-all",
                        selectedProducts.includes(product.key) && product.color
                      )}
                    >
                      {selectedProducts.includes(product.key) && (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      {product.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione um ou mais produtos relacionados ao chamado
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Categoria do chamado</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags multi-select */}
              {ticketTags && ticketTags.length > 0 && (
                <div className="space-y-2 mt-4">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {ticketTags.map(tag => (
                      <Button
                        key={tag.id}
                        type="button"
                        variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTag(tag.id)}
                        style={
                          selectedTagIds.includes(tag.id)
                            ? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }
                            : { borderColor: tag.color, color: tag.color }
                        }
                        className="transition-all"
                      >
                        {selectedTagIds.includes(tag.id) && (
                          <Check className="mr-1 h-3 w-3" />
                        )}
                        {tag.name}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione uma ou mais tags para categorizar o chamado
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relato da Fazenda */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Relato da Fazenda *</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o problema em detalhes..."
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link to="/chamados">Cancelar</Link>
          </Button>
          <Button 
            type="button" 
            variant="secondary" 
            disabled={createTicket.isPending}
            onClick={(e) => handleSubmit(e as any, true)}
          >
            {createTicket.isPending && shouldScheduleVisit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar + Agendar Visita
          </Button>
          <Button 
            type="submit" 
            disabled={createTicket.isPending}
            onClick={() => setShouldScheduleVisit(false)}
          >
            {createTicket.isPending && !shouldScheduleVisit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Chamado
          </Button>
        </div>
      </form>
    </div>
  );
}
