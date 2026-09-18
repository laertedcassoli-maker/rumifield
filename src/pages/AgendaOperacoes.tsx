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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgendaOperacoes, AGENDA_TIPO_LABELS, type AgendaGrupo } from '@/hooks/useAgendaOperacoes';

type Filtro = 'all' | AgendaGrupo;

const FILTROS: Array<{ value: Filtro; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'novas_instalacoes', label: 'Novas Instalações' },
  { value: 'instalacoes_existentes', label: 'Instalações Existentes' },
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

/** Cores fixas (tons suaves) para os técnicos de campo do fluxo de peças.
 *  O banco guarda nome completo (ex.: "Phelipe Rogerio"), por isso usamos prefixo. */
const CORES_FIXAS_TECNICOS: Array<[string, string]> = [
  ['lenilton', 'hsl(32, 70%, 55%)'],  // laranja suave
  ['phelipe',  'hsl(270, 40%, 65%)'], // lilás suave (antes de "roger": "Phelipe Rogerio")
  ['roger',    'hsl(142, 45%, 48%)'], // verde suave
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

export default function AgendaOperacoes() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>('all');
  const [filtroTecnico, setFiltroTecnico] = useState<string>('todos');
  const { eventos, isLoading } = useAgendaOperacoes();

  const tecnicos = useMemo(
    () =>
      [...new Set(eventos.map(e => e.tecnicoNome).filter((n): n is string => !!n))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR')
      ),
    [eventos]
  );

  const calendarEvents = useMemo(
    () =>
      eventos
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
            extendedProps: { linkTo: e.linkTo, tipo: e.tipo, grupo: e.grupo },
          };
        }),
    [eventos, filtro, filtroTecnico]
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Agenda de Operações</h1>
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-none border-2 border-solid border-foreground/60" />
          🏗️ Novas Instalações
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-solid border-foreground/60" />
          🔧 Instalações Existentes
        </span>
        <span className="text-muted-foreground/60">|</span>
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
                eventClick={info => {
                  info.jsEvent.preventDefault();
                  const linkTo = info.event.extendedProps.linkTo as string | undefined;
                  if (linkTo) navigate(linkTo);
                }}
                eventDidMount={info => {
                  const tipo = info.event.extendedProps.tipo as string;
                  const grupo = info.event.extendedProps.grupo as AgendaGrupo;
                  info.el.title = `${AGENDA_TIPO_LABELS[tipo] ?? tipo}: ${info.event.title}`;
                  info.el.style.cursor = 'pointer';
                  if (grupo === 'novas_instalacoes') {
                    info.el.style.borderRadius = '0';
                  }
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
