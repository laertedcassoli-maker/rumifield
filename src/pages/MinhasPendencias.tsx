import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, Contact, GraduationCap, RefreshCcw, Truck, ArrowRight, ListTodo, HardHat, ClipboardCheck, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMinhasPendencias } from '@/hooks/useMinhasPendencias';

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_peca: 'Aguardando peça',
  planejado: 'Planejado',
  reagendado: 'Reagendado',
  em_andamento: 'Em andamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_elaboracao: 'Em elaboração',
  planejada: 'Planejada',
  em_execucao: 'Em execução',
  rascunho: 'Rascunho',
  solicitado: 'Solicitado',
  pendente: 'Pendente',
  processamento: 'Em processamento',
};

const STAGE_LABELS: Record<string, string> = {
  pre_instalacao: 'Pré Instalação',
  instalacao: 'Instalação',
};

function formatDate(value: string | null) {
  if (!value) return 'Sem data';
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return d.toLocaleDateString('pt-BR');
}

interface RowProps {
  code: string;
  cliente: string;
  fazenda?: string | null;
  date: string;
  status: string;
  to: string;
}

function PendenciaRow({ code, cliente, fazenda, date, status, to }: RowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{code}</span>
          <Badge variant="secondary" className="text-[10px]">
            {statusLabels[status] ?? status}
          </Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {cliente}
          {fazenda ? ` · ${fazenda}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to={to}>
          Abrir
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ElementType;
  count: number;
  isLoading: boolean;
  emptyText: string;
  to?: string;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, count, isLoading, emptyText, to, children }: SectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          <span>{title}</span>
          {!isLoading && (
            <Badge variant={count > 0 ? 'default' : 'secondary'} className={to ? '' : 'ml-auto'}>
              {count}
            </Badge>
          )}
          {to && !isLoading && (
            <Link
              to={to}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todas
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : count === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function MinhasPendencias() {
  const { preventivas, visitas, chamados, coletaReversa, envios, instalacoes, treinamentos, ordensServico, aprovacoesInstalacao, canApproveInstalacao, total, isLoading } = useMinhasPendencias();

  const visitasUnificadas = [
    ...(preventivas.data ?? []).map(item => ({
      key: `prev-${item.id}`,
      code: item.routeCode ?? 'Rota',
      cliente: item.clienteNome,
      fazenda: item.fazenda,
      date: formatDate(item.plannedDate),
      status: item.status,
      to: `/preventivas/execucao/${item.routeId}/atendimento/${item.id}`,
    })),
    ...(visitas.data ?? []).map(item => ({
      key: `visita-${item.id}`,
      code: item.visitCode ?? item.ticketCode ?? 'Visita',
      cliente: item.clienteNome,
      fazenda: item.fazenda,
      date: formatDate(item.plannedDate),
      status: item.status,
      to: `/chamados/visita/${item.id}`,
    })),
  ];

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ListTodo className="h-6 w-6 text-primary" />
          Minhas Pendências
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isLoading
            ? 'Carregando suas pendências...'
            : total === 0
              ? 'Você não tem nenhuma pendência no momento.'
              : `Você tem ${total} ${total === 1 ? 'pendência' : 'pendências'} em aberto.`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Visitas Técnicas"
          icon={Contact}
          count={visitasUnificadas.length}
          isLoading={preventivas.isLoading || visitas.isLoading}
          emptyText="Nenhuma pendência em Visitas Técnicas"
          to="/visita-tecnica?meu=1&status=pendente"
        >
          {visitasUnificadas.map(item => (
            <PendenciaRow
              key={item.key}
              code={item.code}
              cliente={item.cliente}
              fazenda={item.fazenda}
              date={item.date}
              status={item.status}
              to={item.to}
            />
          ))}
        </Section>

        <Section
          title="Chamados"
          icon={AlertTriangle}
          count={chamados.data?.length ?? 0}
          isLoading={chamados.isLoading}
          emptyText="Nenhuma pendência em Chamados"
          to="/chamados?meu=1&status=pendente"
        >
          {chamados.data?.map(item => (
            <PendenciaRow
              key={item.id}
              code={item.ticketCode ?? 'Chamado'}
              cliente={item.clienteNome}
              fazenda={item.fazenda}
              date={formatDate(item.createdAt)}
              status={item.status}
              to={`/chamados/${item.id}`}
            />
          ))}
        </Section>

        <Section
          title="Coleta Reversa"
          icon={RefreshCcw}
          count={coletaReversa.data?.length ?? 0}
          isLoading={coletaReversa.isLoading}
          emptyText="Nenhuma pendência em Coleta Reversa"
          to="/pedidos?tipo=coleta_reversa&meu=1&status=pendente"
        >
          {coletaReversa.data?.map(item => (
            <PendenciaRow
              key={item.id}
              code={item.pedidoCode ?? 'Solicitação'}
              cliente={item.clienteNome}
              fazenda={item.fazenda}
              date={formatDate(item.createdAt)}
              status={item.status}
              to="/pedidos?tipo=coleta_reversa"
            />
          ))}
        </Section>

        <Section
          title="Envios"
          icon={Truck}
          count={envios.data?.length ?? 0}
          isLoading={envios.isLoading}
          emptyText="Nenhuma pendência em Envios"
          to="/pedidos?tipo=envio&meu=1&status=pendente"
        >
          {envios.data?.map(item => (
            <PendenciaRow
              key={item.id}
              code={item.pedidoCode ?? 'Solicitação'}
              cliente={item.clienteNome}
              fazenda={item.fazenda}
              date={formatDate(item.createdAt)}
              status={item.status}
              to="/pedidos?tipo=envio"
            />
          ))}
        </Section>

        <Section
          title="Instalações"
          icon={HardHat}
          count={instalacoes.data?.length ?? 0}
          isLoading={instalacoes.isLoading}
          emptyText="Nenhuma pendência em Instalações"
          to="/instalacoes?meu=1"
        >
          {instalacoes.data?.map(item => (
            <PendenciaRow
              key={item.id}
              code={STAGE_LABELS[item.stage] ?? item.stage}
              cliente={item.clienteNome}
              fazenda={item.fazenda}
              date={formatDate(item.plannedDate)}
              status={item.status}
              to={`/instalacoes/etapa/${item.id}`}
            />
          ))}
        </Section>

        <Section
          title="Treinamento de Manutenção"
          icon={GraduationCap}
          count={treinamentos.data?.length ?? 0}
          isLoading={treinamentos.isLoading}
          emptyText="Nenhuma pendência em Treinamento de Manutenção"
          to="/treinamento?meu=1&status=pendente"
        >
          {treinamentos.data?.map(item => (
            <PendenciaRow
              key={item.id}
              code="Treinamento de Manutenção"
              cliente={item.clienteNome}
              fazenda={item.fazenda}
              date={formatDate(item.plannedDate)}
              status={item.status}
              to="/treinamento?meu=1&status=pendente"
            />
          ))}
        </Section>

        <Section
          title="Ordens de Serviço"
          icon={FileText}
          count={ordensServico.data?.length ?? 0}
          isLoading={ordensServico.isLoading}
          emptyText="Nenhuma pendência em Ordens de Serviço"
          to="/oficina/os?meu=1&status=pendente"
        >
          {ordensServico.data?.map(item => (
            <PendenciaRow
              key={item.id}
              code={item.code}
              cliente={item.atividade ?? '—'}
              date={formatDate(item.createdAt)}
              status={item.status}
              to="/oficina/os?meu=1&status=pendente"
            />
          ))}
        </Section>

        {canApproveInstalacao && (
          <Section
            title="Aprovações de Instalação"
            icon={ClipboardCheck}
            count={aprovacoesInstalacao.data?.length ?? 0}
            isLoading={aprovacoesInstalacao.isLoading}
            emptyText="Nenhuma aprovação pendente"
          >
            {aprovacoesInstalacao.data?.map(item => (
              <PendenciaRow
                key={item.id}
                code={STAGE_LABELS[item.stage] ?? item.stage}
                cliente={item.clienteNome}
                fazenda={item.fazenda}
                date={formatDate(item.plannedDate)}
                status={item.status}
                to={`/instalacoes/etapa/${item.id}`}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
