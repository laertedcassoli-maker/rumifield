import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, MapPin, Calendar, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Visitas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cliente_id: '', descricao: '' });

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: visitas, isLoading } = useQuery({
    queryKey: ['visitas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitas')
        .select('*, clientes(nome, fazenda)')
        .order('data_visita', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createVisita = useMutation({
    mutationFn: async (data: { cliente_id: string; descricao: string }) => {
      const { error } = await supabase.from('visitas').insert({
        tecnico_id: user?.id,
        cliente_id: data.cliente_id,
        descricao: data.descricao,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      setOpen(false);
      setForm({ cliente_id: '', descricao: '' });
      toast({ title: 'Visita registrada com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao registrar visita', description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    createVisita.mutate(form);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visitas Técnicas</h1>
          <p className="text-muted-foreground">Registre e acompanhe suas visitas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Visita
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nova Visita</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente / Fazenda</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome} {cliente.fazenda && `- ${cliente.fazenda}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição da Visita</Label>
                <Textarea
                  placeholder="Descreva o que foi feito..."
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={4}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createVisita.isPending}>
                {createVisita.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Visita'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visitas?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Nenhuma visita registrada</h3>
            <p className="text-muted-foreground">Clique em "Nova Visita" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {visitas?.map((visita) => (
            <Card key={visita.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-4 w-4 text-primary" />
                      {visita.clientes?.nome}
                    </CardTitle>
                    {visita.clientes?.fazenda && (
                      <p className="text-sm text-muted-foreground">{visita.clientes.fazenda}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(visita.data_visita), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{visita.descricao || 'Sem descrição'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
