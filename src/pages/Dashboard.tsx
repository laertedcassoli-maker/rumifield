import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Beaker, AlertTriangle, CheckCircle, Users, Calendar, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FazendaStatus {
  id: string;
  nome: string;
  fazenda: string | null;
  data_ativacao_rumiflow: string | null;
  status: string;
  ultima_afericao: string | null;
  dias_sem_afericao: number | null;
}

export default function Dashboard() {
  const { profile, role } = useAuth();

  const { data: fazendasStatus, isLoading } = useQuery({
    queryKey: ['dashboard-fazendas-status'],
    queryFn: async () => {
      // Busca clientes ativos
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, fazenda, data_ativacao_rumiflow, status')
        .eq('status', 'ativo');

      if (clientesError) throw clientesError;

      // Busca última aferição de cada cliente
      const { data: afericoes, error: afericoesError } = await supabase
        .from('estoque_cliente')
        .select('cliente_id, data_afericao')
        .order('data_afericao', { ascending: false });

      if (afericoesError) throw afericoesError;

      // Agrupa última aferição por cliente
      const ultimaAfericaoPorCliente: Record<string, string> = {};
      afericoes?.forEach(af => {
        if (!ultimaAfericaoPorCliente[af.cliente_id]) {
          ultimaAfericaoPorCliente[af.cliente_id] = af.data_afericao;
        }
      });

      const hoje = new Date();

      // Mapeia status de cada fazenda
      const fazendasComStatus: FazendaStatus[] = (clientes || []).map(cliente => {
        const ultimaAfericao = ultimaAfericaoPorCliente[cliente.id] || null;
        let diasSemAfericao: number | null = null;

        if (ultimaAfericao) {
          diasSemAfericao = differenceInDays(hoje, parseISO(ultimaAfericao));
        } else if (cliente.data_ativacao_rumiflow) {
          // Se não tem aferição mas tem data de ativação, conta desde a ativação
          diasSemAfericao = differenceInDays(hoje, parseISO(cliente.data_ativacao_rumiflow));
        }

        return {
          id: cliente.id,
          nome: cliente.nome,
          fazenda: cliente.fazenda,
          data_ativacao_rumiflow: cliente.data_ativacao_rumiflow,
          status: cliente.status,
          ultima_afericao: ultimaAfericao,
          dias_sem_afericao: diasSemAfericao,
        };
      });

      return fazendasComStatus;
    },
  });

  // Filtra fazendas que precisam de atenção (sem aferição há +30 dias)
  const fazendasAtencao = fazendasStatus?.filter(f => 
    f.data_ativacao_rumiflow && // Só considera fazendas com data de ativação
    (f.dias_sem_afericao === null || f.dias_sem_afericao > 30)
  ) || [];

  // Fazendas em dia (com aferição nos últimos 30 dias)
  const fazendasEmDia = fazendasStatus?.filter(f => 
    f.data_ativacao_rumiflow && 
    f.dias_sem_afericao !== null && 
    f.dias_sem_afericao <= 30
  ) || [];

  // Fazendas sem data de ativação
  const fazendasSemAtivacao = fazendasStatus?.filter(f => !f.data_ativacao_rumiflow) || [];

  const totalAtivas = fazendasStatus?.filter(f => f.data_ativacao_rumiflow).length || 0;

  const statCards = [
    {
      title: 'Fazendas Ativas',
      value: totalAtivas,
      icon: Users,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      title: 'Precisam de Aferição',
      value: fazendasAtencao.length,
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Em Dia',
      value: fazendasEmDia.length,
      icon: CheckCircle,
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ];

  const getDiasLabel = (dias: number | null) => {
    if (dias === null) return 'Sem aferição';
    if (dias === 0) return 'Hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  };

  const getDiasBadgeVariant = (dias: number | null) => {
    if (dias === null) return 'bg-destructive text-destructive-foreground';
    if (dias > 60) return 'bg-destructive text-destructive-foreground';
    if (dias > 30) return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}!</h1>
        <p className="text-muted-foreground">
          Dashboard de Acompanhamento - Estoque Químicos
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

      {/* Lista de fazendas que precisam de aferição */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Fazendas sem Aferição há mais de 30 dias
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/estoque">
                <Beaker className="h-4 w-4 mr-2" />
                Ir para Aferição
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : fazendasAtencao.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
              <p className="text-muted-foreground">
                Todas as fazendas ativas estão com aferição em dia!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produtor</TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Data Ativação</TableHead>
                  <TableHead>Última Aferição</TableHead>
                  <TableHead>Dias sem Aferição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fazendasAtencao
                  .sort((a, b) => (b.dias_sem_afericao || 999) - (a.dias_sem_afericao || 999))
                  .map((fazenda) => (
                  <TableRow key={fazenda.id}>
                    <TableCell className="font-medium">{fazenda.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {fazenda.fazenda || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fazenda.data_ativacao_rumiflow 
                        ? format(parseISO(fazenda.data_ativacao_rumiflow), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fazenda.ultima_afericao 
                        ? format(parseISO(fazenda.ultima_afericao), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Nunca'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge className={getDiasBadgeVariant(fazenda.dias_sem_afericao)}>
                        {getDiasLabel(fazenda.dias_sem_afericao)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fazendas sem data de ativação configurada */}
      {fazendasSemAtivacao.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Fazendas sem Data de Ativação
                <Badge variant="secondary">{fazendasSemAtivacao.length}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/clientes">
                  Configurar
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Estas fazendas não aparecem no acompanhamento pois não possuem data de ativação no RumiFlow configurada.
            </p>
            <div className="flex flex-wrap gap-2">
              {fazendasSemAtivacao.slice(0, 10).map(f => (
                <Badge key={f.id} variant="outline">
                  {f.fazenda || f.nome}
                </Badge>
              ))}
              {fazendasSemAtivacao.length > 10 && (
                <Badge variant="outline">+{fazendasSemAtivacao.length - 10} mais</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
