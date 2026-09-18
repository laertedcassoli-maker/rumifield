import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgendaOperacoes, AGENDA_TIPO_LABELS, type AgendaGrupo } from '@/hooks/useAgendaOperacoes';

type Filtro = 'all' | AgendaGrupo;

const FILTROS: Array<{ value: Filtro; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'novas_instalacoes', label: 'Novas Instalações' },
  { value: 'instalacoes_existentes', label: 'Instalações Existentes' },
];

const GRUPO_COLORS: Record<AgendaGrupo, string> = {
  novas_instalacoes: 'hsl(var(--primary))',
  instalacoes_existentes: 'hsl(var(--accent-foreground))',
};

export default function AgendaOperacoes() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('all');
  const { eventos, isLoading } = useAgendaOperacoes();

  const calendarEvents = useMemo(
    () =>
      eventos
        .filter(e => filtro === 'all' || e.grupo === filtro)
        .map(e => ({
          id: e.id,
          title: e.titulo,
          start: e.data,
          allDay: true,
          backgroundColor: GRUPO_COLORS[e.grupo],
          borderColor: GRUPO_COLORS[e.grupo],
          extendedProps: { linkTo: e.linkTo, tipo: e.tipo },
        })),
    [eventos, filtro]
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Agenda de Operações</h1>
      </div>

      <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: GRUPO_COLORS.novas_instalacoes }}
          />
          Novas Instalações
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: GRUPO_COLORS.instalacoes_existentes }}
          />
          Instalações Existentes
        </span>
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
                eventClick={info => {
                  info.jsEvent.preventDefault();
                  const linkTo = info.event.extendedProps.linkTo as string | undefined;
                  if (linkTo) navigate(linkTo);
                }}
                eventDidMount={info => {
                  const tipo = info.event.extendedProps.tipo as string;
                  info.el.title = `${AGENDA_TIPO_LABELS[tipo] ?? tipo}: ${info.event.title}`;
                  info.el.style.cursor = 'pointer';
                }}
                dayMaxEvents={3}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
