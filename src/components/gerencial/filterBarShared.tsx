import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

export type { DateRange };

export type PresetKey = 'mes_atual' | 'trimestre_atual' | 'ano_inteiro' | 'personalizado';

export const presets = {
  mesAtual: (): DateRange => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  trimestreAtual: (): DateRange => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }),
  anoInteiro: (): DateRange => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
};

export const PRESET_OPTIONS: Array<{ key: Exclude<PresetKey, 'personalizado'>; label: string }> = [
  { key: 'mes_atual', label: 'Mês atual' },
  { key: 'trimestre_atual', label: 'Trimestre atual' },
  { key: 'ano_inteiro', label: 'Ano inteiro' },
];

export function rangeForPreset(key: Exclude<PresetKey, 'personalizado'>): DateRange {
  if (key === 'ano_inteiro') return presets.anoInteiro();
  if (key === 'trimestre_atual') return presets.trimestreAtual();
  return presets.mesAtual();
}

export function serializeRange(range?: DateRange) {
  return range?.from
    ? { from: format(range.from, 'yyyy-MM-dd'), to: range.to ? format(range.to, 'yyyy-MM-dd') : null }
    : null;
}

export function parseRange(raw: unknown): DateRange | undefined {
  const r = raw as { from?: string; to?: string | null } | null;
  if (!r?.from) return undefined;
  return { from: new Date(`${r.from}T00:00:00`), to: r.to ? new Date(`${r.to}T23:59:59`) : undefined };
}

export function rangeLabel(range?: DateRange) {
  if (!range?.from) return 'Selecionar período';
  const f = format(range.from, 'dd/MM', { locale: ptBR });
  if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: ptBR });
  return `${f} – ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
}

/** Rótulo dos campos, no mesmo padrão de Oficina › Gestão de OS. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
      {children}
    </span>
  );
}

export function useFieldTechnicians() {
  return useQuery({
    queryKey: ['gerencial-field-technicians'],
    queryFn: async () => {
      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tecnico_campo');
      if (rErr) throw rErr;
      if (!roles?.length) return [] as { id: string; nome: string }[];

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', roles.map((r) => r.user_id))
        .eq('is_active', true)
        .order('nome');
      if (pErr) throw pErr;
      return (profiles ?? []) as { id: string; nome: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function PeriodField({
  range,
  onChange,
}: {
  range?: DateRange;
  onChange: (r?: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(range?.from ?? new Date());

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 4 + i);
  }, []);

  const setYear = (year: number) =>
    setCalendarMonth(new Date(year, calendarMonth.getMonth(), 1));
  const shiftYear = (delta: number) =>
    setCalendarMonth(new Date(calendarMonth.getFullYear() + delta, calendarMonth.getMonth(), 1));

  return (
    <div className="flex flex-col gap-1 min-w-[240px]">
      <FieldLabel>Período</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-9 justify-start text-left font-normal min-w-[220px]', !range?.from && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {rangeLabel(range)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="border-b p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftYear(-1)} aria-label="Ano anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(calendarMonth.getFullYear())} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-8 w-[110px] text-sm font-medium">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftYear(1)} aria-label="Próximo ano">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            >
              Ano atual
            </Button>
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={range}
            onSelect={onChange}
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Atalhos de período em formato de links, igual Gestão de OS. */
export function PresetShortcuts({
  active,
  onSelect,
}: {
  active: PresetKey;
  onSelect: (key: Exclude<PresetKey, 'personalizado'>) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-0.5">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atalhos:</span>
      {PRESET_OPTIONS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onSelect(p.key)}
          className={cn(
            'text-[11px] font-medium transition-colors',
            active === p.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Badge de resumo + botão limpar, alinhados à direita. */
export function FilterActions({
  summary,
  onClear,
}: {
  summary?: React.ReactNode;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 ml-auto pb-0.5">
      {summary != null && (
        <Badge variant="secondary" className="h-7 whitespace-nowrap">{summary}</Badge>
      )}
      <Button variant="ghost" size="sm" onClick={onClear} className="h-9 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4 mr-1" /> Limpar
      </Button>
    </div>
  );
}

export function TecnicoCombobox({
  technicians,
  selected,
  onToggle,
  onClear,
}: {
  technicians: { id: string; nome: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const label =
    selected.length === 0
      ? 'Todos os técnicos'
      : selected.length === 1
        ? technicians.find((t) => t.id === selected[0])?.nome ?? '1 selecionado(s)'
        : `${selected.length} selecionado(s)`;

  return (
    <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[260px]">
      <FieldLabel>Técnico de campo</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 justify-between font-normal">
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar técnico..." />
            <CommandList>
              <CommandEmpty>Nenhum técnico.</CommandEmpty>
              <CommandGroup>
                {technicians.map((t) => (
                  <CommandItem key={t.id} value={t.nome} onSelect={() => onToggle(t.id)}>
                    <Check className={cn('mr-2 h-4 w-4', selected.includes(t.id) ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{t.nome}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={onClear}>
                Limpar seleção
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Seleção única em formato de combobox, no mesmo padrão dos filtros de Gestão de OS. */
export function SingleSelectCombobox<T extends string>({
  label,
  placeholder,
  searchPlaceholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[260px]">
      <FieldLabel>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 justify-between font-normal">
            <span className="truncate">{current?.label ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            {options.length > 8 && <CommandInput placeholder={searchPlaceholder ?? 'Buscar...'} />}
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      onChange(value === o.value ? null : o.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
