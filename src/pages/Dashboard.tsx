import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Beaker, ShoppingCart, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { profile, role } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [visitasRes, pedidosRes, clientesRes] = await Promise.all([
        supabase.from('visitas').select('id', { count: 'exact', head: true }),
        supabase.from('pedidos').select('id', { count: 'exact', head: true }),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
      ]);

      return {
        visitas: visitasRes.count || 0,
        pedidos: pedidosRes.count || 0,
        clientes: clientesRes.count || 0,
      };
    },
  });

  const statCards = [
    {
      title: 'Visitas Técnicas',
      value: stats?.visitas || 0,
      icon: MapPin,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Pedidos de Peças',
      value: stats?.pedidos || 0,
      icon: ShoppingCart,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    {
      title: 'Clientes',
      value: stats?.clientes || 0,
      icon: Users,
      color: 'text-info',
      bg: 'bg-info/10',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}!</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao AgriField. Você está logado como <span className="capitalize font-medium">{role}</span>.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Últimas Visitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nenhuma visita registrada ainda. Comece registrando sua primeira visita técnica.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-secondary" />
              Pedidos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nenhum pedido de peças ainda. Solicite peças quando necessário.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
