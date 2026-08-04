import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

export type { DateRange };

export const presets = {
  mesAtual: (): DateRange => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  trimestreAtual: (): DateRange => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }),
  anoInteiro: (): DateRange => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
};

export function serializeRange(range?: DateRange) {
  return range?.from
    ? { from: format(range.from, 'yyyy-MM-dd'), to: range.to ? format(range.to, 'yyyy-MM-dd') : null }
    : null;
}

export function parseRange(raw: unknown): DateRange | undefined {
  const r = raw as { from?: string; to?: string | null } | null;
  if (!r?.from) return undefined;
  return { from: new Date(`${r.from}T00:00:00`), to: r.to ? new Date(`${r.to}T00:00:00`) : undefined };
}

export function rangeLabel(range?: DateRange) {
  if (!range?.from) return 'Selecionar período';
  const f = format(range.from, "dd MMM yyyy", { locale: ptBR });
  if (!range.to) return f;
  return `${f} — ${format(range.to, 'dd MMM yyyy', { locale: ptBR })}`;
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
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Período</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('h-9 justify-start gap-2 text-left font-normal', !range?.from && 'text-muted-foreground')}>
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="text-xs">{rangeLabel(range)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={onChange}
            numberOfMonths={2}
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PresetButtons({ onSelect }: { onSelect: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 self-end">
      <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => onSelect(presets.mesAtual())}>
        Mês atual
      </Button>
      <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => onSelect(presets.trimestreAtual())}>
        Trimestre atual
      </Button>
      <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => onSelect(presets.anoInteiro())}>
        Ano inteiro
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
        ? technicians.find((t) => t.id === selected[0])?.nome ?? '1 técnico'
        : `${selected.length} técnicos`;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Técnico de campo</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-[230px] justify-between gap-2 font-normal">
            <span className="truncate text-xs">{label}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
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

export function SingleSelectPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <Badge
            key={o.value}
            variant={value === o.value ? 'default' : 'outline'}
            className="cursor-pointer px-2.5 py-1 text-[11.5px] font-medium"
            onClick={() => onChange(value === o.value ? null : o.value)}
          >
            {o.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
