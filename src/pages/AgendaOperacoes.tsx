import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Wrench, AlertTriangle, ShieldCheck, Plus, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  useAgendaOperacoes,
  useAgendaAusencias,
  AGENDA_TIPO_LABELS,
  AGENDA_GRUPO_LABELS,
  type AgendaGrupo,
} from '@/hooks/useAgendaOperacoes';

type Filtro = 'all' | AgendaGrupo;

const FILTROS: Array<{ value: Filtro; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'instalacao', label: AGENDA_GRUPO_LABELS.instalacao },
  { value: 'corretiva', label: AGENDA_GRUPO_LABELS.corretiva },
  { value: 'preventiva', label: AGENDA_GRUPO_LABELS.preventiva },
];

/**
 * Paleta fixa de cores distintas para técnicos/responsáveis.
 * São dados visuais por pessoa (não tokens de tema), por isso valores literais.
 */
const PALETA_TECNICOS = [
  'hsl(221, 83%, 53%)', // azul
  'hsl(142, 71%, 40%)', // verde
  'hsl(32, 95%, 44%)', // laranja
  'hsl(328, 80%, 45%)', // magenta
  'hsl(190, 90%, 38%)', // ciano
  'hsl(262, 70%, 55%)', // violeta
  'hsl(0, 74%, 50%)', // vermelho
  'hsl(85, 65%, 38%)', // verde-lima
  'hsl(25, 80%, 40%)', // marrom-alaranjado
  'hsl(300, 60%, 40%)', // roxo
];

const COR_SEM_RESPONSAVEL = 'hsl(215, 16%, 55%)'; // cinza neutro
const COR_AUSENCIA = 'hsl(215, 14%, 45%)'; // cinza para bloqueios de agenda

/** Ícone por categoria de atividade. Cor neutra: herda a cor de texto do evento. */
function GrupoIcon({ grupo, className }: { grupo: AgendaGrupo; className?: string }) {
  if (grupo === 'instalacao') return <Wrench className={className} />;
  if (grupo === 'corretiva') return <AlertTriangle className={className} />;
  return <ShieldCheck className={className} />;
}

/** Cores fixas (tons suaves) para os técnicos de campo do fluxo de peças.
 *  O banco guarda nome completo (ex.: "Phelipe Rogerio"), por isso usamos prefixo. */
const CORES_FIXAS_TECNICOS: Array<[string, string]> = [
  ['lenilton', 'hsl(217, 55%, 58%)'], // azul suave
  ['phelipe',  'hsl(38, 55%, 52%)'],  // âmbar suave (antes de "roger": "Phelipe Rogerio")
  ['roger',    'hsl(158, 45%, 42%)'], // verde esmeralda suave
];

/** Cor determinística por nome: mesmo nome -> mesma cor, sempre. */
function corPorTecnico(nome: string | null): string {
  if (!nome) return COR_SEM_RESPONSAVEL;
  const normalized = nome.trim().toLowerCase();
  for (const [key, color] of CORES_FIXAS_TECNICOS) {
    if (normalized.startsWith(key)) return color;
  }
  let hash = 5381;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash * 33) ^ nome.charCodeAt(i);
  }
  const idx = Math.abs(hash) % PALETA_TECNICOS.length;
  return PALETA_TECNICOS[idx];
}

/** FullCalendar trata `end` como exclusivo em eventos all-day: soma 1 dia. */
function endExclusivo(dataFim: string) {
  const d = new Date(`${dataFim}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function AgendaOperacoes() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>('all');
  const [filtroTecnico, setFiltroTecnico] = useState<string>('todos');
  const { eventos, isLoading } = useAgendaOperacoes();
  const { ausencias, criar, remover } = useAgendaAusencias();

  const podeGerenciarAusencias = role === 'admin' || role === 'coordenador_servicos';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ tecnico: '', descricao: '', inicio: '', fim: '' });
  const [ausenciaParaRemover, setAusenciaParaRemover] = useState<string | null>(null);

  const { data: tecnicosDisponiveis = [] } = useQuery({
    queryKey: ['agenda-tecnicos-ausencia'],
    enabled: podeGerenciarAusencias,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles!inner(id, nome, is_active)')
        .in('role', ['tecnico_campo', 'tecnico_oficina']);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as any[]) {
        const p = row.profiles;
        if (p?.is_active) map.set(p.id as string, p.nome as string);
      }
      return [...map.entries()]
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
  });

  const tecnicos = useMemo(
    () =>
      [...new Set(eventos.map(e => e.tecnicoNome).filter((n): n is string => !!n))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR')
      ),
    [eventos]
  );

  const calendarEvents = useMemo(() => {
    const doTrabalho = eventos
      .filter(e => filtro === 'all' || e.grupo === filtro)
      .filter(e => filtroTecnico === 'todos' || e.tecnicoNome === filtroTecnico)
      .map(e => {
        const cor = corPorTecnico(e.tecnicoNome);
        return {
          id: e.id,
          title: e.titulo,
          start: e.data,
          allDay: true,
          backgroundColor: cor,
          borderColor: cor,
          extendedProps: { linkTo: e.linkTo, tipo: e.tipo, grupo: e.grupo, ausenciaId: null },
        };
      });

    const bloqueios = ausencias
      .filter(a => filtroTecnico === 'todos' || a.tecnicoNome === filtroTecnico)
      .map(a => ({
        id: `ausencia-${a.id}`,
        title: `${a.description}${a.tecnicoNome ? ` — ${a.tecnicoNome}` : ''}`,
        start: a.start_date,
        end: endExclusivo(a.end_date),
        allDay: true,
        backgroundColor: COR_AUSENCIA,
        borderColor: COR_AUSENCIA,
        extendedProps: { linkTo: null, tipo: 'ausencia', grupo: null, ausenciaId: a.id },
      }));

    return [...doTrabalho, ...bloqueios];
  }, [eventos, ausencias, filtro, filtroTecnico]);

  const handleSalvarAusencia = async () => {
    if (!form.tecnico || !form.descricao.trim() || !form.inicio || !form.fim) {
      toast.error('Preencha técnico, descrição, data de início e data de fim.');
      return;
    }
    if (form.fim < form.inicio) {
      toast.error('A data de fim não pode ser anterior à data de início.');
      return;
    }
    try {
      await criar.mutateAsync({
        technician_user_id: form.tecnico,
        description: form.descricao.trim(),
        start_date: form.inicio,
        end_date: form.fim,
      });
      toast.success('Ausência registrada na agenda.');
      setDialogOpen(false);
      setForm({ tecnico: '', descricao: '', inicio: '', fim: '' });
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível salvar a ausência.');
    }
  };

  const handleRemoverAusencia = async () => {
    if (!ausenciaParaRemover) return;
    try {
      await remover.mutateAsync(ausenciaParaRemover);
      toast.success('Ausência removida.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível remover a ausência.');
    } finally {
      setAusenciaParaRemover(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Agenda de Operações</h1>
        {podeGerenciarAusencias && (
          <Button size="sm" className="ml-auto h-8 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nova Ausência
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map(f => (
          <Button
            key={f.value}
            size="sm"
            variant={filtro === f.value ? 'default' : 'outline'}
            onClick={() => setFiltro(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <Select value={filtroTecnico} onValueChange={setFiltroTecnico}>
          <SelectTrigger className="h-8 w-[220px]">
            <SelectValue placeholder="Todos os técnicos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os técnicos</SelectItem>
            {tecnicos.map(nome => (
              <SelectItem key={nome} value={nome}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(['instalacao', 'corretiva', 'preventiva'] as AgendaGrupo[]).map(g => (
          <span key={g} className="flex items-center gap-1.5">
            <GrupoIcon grupo={g} className="h-3.5 w-3.5" />
            {AGENDA_GRUPO_LABELS[g]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <CalendarOff className="h-3.5 w-3.5" />
          Ausência
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {tecnicos.map(nome => (
          <span key={nome} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: corPorTecnico(nome) }}
            />
            {nome}
          </span>
        ))}
        {eventos.some(e => !e.tecnicoNome) && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: COR_SEM_RESPONSAVEL }}
            />
            Sem responsável
          </span>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-3">
          {isLoading ? (
            <Skeleton className="h-[520px] w-full" />
          ) : (
            <div className="agenda-operacoes min-w-0 text-sm">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
                initialView="dayGridMonth"
                locale={ptBrLocale}
                height="auto"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
                }}
                events={calendarEvents}
                eventContent={arg => {
                  const grupo = arg.event.extendedProps.grupo as AgendaGrupo | null;
                  return (
                    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                      {grupo ? (
                        <GrupoIcon grupo={grupo} className="h-3 w-3 shrink-0" />
                      ) : (
                        <CalendarOff className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{arg.event.title}</span>
                    </span>
                  );
                }}
                eventClick={info => {
                  info.jsEvent.preventDefault();
                  const ausenciaId = info.event.extendedProps.ausenciaId as string | null;
                  if (ausenciaId) {
                    if (podeGerenciarAusencias) setAusenciaParaRemover(ausenciaId);
                    return;
                  }
                  const linkTo = info.event.extendedProps.linkTo as string | undefined;
                  if (linkTo) navigate(linkTo);
                }}
                eventDidMount={info => {
                  const tipo = info.event.extendedProps.tipo as string;
                  const ausenciaId = info.event.extendedProps.ausenciaId as string | null;
                  if (ausenciaId) {
                    info.el.title = `Ausência: ${info.event.title}`;
                    info.el.style.cursor = podeGerenciarAusencias ? 'pointer' : 'default';
                    info.el.style.backgroundImage =
                      'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 8px)';
                    info.el.style.opacity = '0.9';
                    return;
                  }
                  info.el.title = `${AGENDA_TIPO_LABELS[tipo] ?? tipo}: ${info.event.title}`;
                  info.el.style.cursor = 'pointer';
                }}
                dayMaxEvents={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Ausência</DialogTitle>
            <DialogDescription>
              Bloqueia a agenda do técnico no período informado (férias, folga etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Técnico</Label>
              <Select value={form.tecnico} onValueChange={v => setForm(f => ({ ...f, tecnico: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicosDisponiveis.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex.: Férias, Folga"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data início</Label>
                <Input
                  type="date"
                  value={form.inicio}
                  onChange={e => setForm(f => ({ ...f, inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data fim</Label>
                <Input
                  type="date"
                  value={form.fim}
                  onChange={e => setForm(f => ({ ...f, fim: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarAusencia} disabled={criar.isPending}>
              {criar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!ausenciaParaRemover}
        onOpenChange={open => !open && setAusenciaParaRemover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ausência?</AlertDialogTitle>
            <AlertDialogDescription>
              O bloqueio sai da agenda imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoverAusencia}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
