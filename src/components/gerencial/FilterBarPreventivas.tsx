import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  type DateRange,
  PeriodField,
  PresetButtons,
  SingleSelectPills,
  TecnicoCombobox,
  parseRange,
  presets,
  serializeRange,
  useFieldTechnicians,
} from './filterBarShared';

const STORAGE_KEY = 'preventivas:filters:v1';

export type FazendaStatus = 'em_dia' | 'elegivel' | 'atrasada' | 'sem_historico';

const STATUS_OPTIONS: { value: FazendaStatus; label: string }[] = [
  { value: 'em_dia', label: 'Em dia' },
  { value: 'elegivel', label: 'Elegível' },
  { value: 'atrasada', label: 'Atrasada' },
  { value: 'sem_historico', label: 'Sem histórico' },
];

export interface PreventivasFilters {
  dateRange?: DateRange;
  selectedTecnicos: string[];
  selectedStatus: FazendaStatus | null;
}

interface Props {
  onFilterChange?: (filters: PreventivasFilters) => void;
  /** Preset usado quando não há filtro salvo. Padrão: 'mes'. */
  defaultPreset?: 'mes' | 'trimestre' | 'ano';
}

export function FilterBarPreventivas({ onFilterChange, defaultPreset = 'mes' }: Props) {
  const fallbackRange = () =>
    defaultPreset === 'ano'
      ? presets.anoInteiro()
      : defaultPreset === 'trimestre'
        ? presets.trimestreAtual()
        : presets.mesAtual();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const r = parseRange(parsed.dateRange);
        if (r) return r;
      }
    } catch { /* ignore */ }
    return fallbackRange();
  });

  const [selectedTecnicos, setSelectedTecnicos] = useState<string[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.selectedTecnicos)) return parsed.selectedTecnicos as string[];
      }
    } catch { /* ignore */ }
    return [];
  });

  const [selectedStatus, setSelectedStatus] = useState<FazendaStatus | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.selectedStatus === 'string') return parsed.selectedStatus as FazendaStatus;
      }
    } catch { /* ignore */ }
    return null;
  });

  const { data: technicians = [] } = useFieldTechnicians();

  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ dateRange: serializeRange(dateRange), selectedTecnicos, selectedStatus }),
      );
    } catch { /* ignore */ }
    onFilterChangeRef.current?.({ dateRange, selectedTecnicos, selectedStatus });
  }, [dateRange, selectedTecnicos, selectedStatus]);

  const hasFilters = useMemo(
    () => selectedTecnicos.length > 0 || selectedStatus !== null,
    [selectedTecnicos, selectedStatus],
  );

  return (
    <Card className="p-4">
      <div className="flex flex-row flex-wrap items-start gap-[14px]">
        <PeriodField range={dateRange} onChange={setDateRange} />

        <TecnicoCombobox
          technicians={technicians}
          selected={selectedTecnicos}
          onToggle={(id) =>
            setSelectedTecnicos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onClear={() => setSelectedTecnicos([])}
        />

        <SingleSelectPills<FazendaStatus>
          label="Status da fazenda"
          options={STATUS_OPTIONS}
          value={selectedStatus}
          onChange={setSelectedStatus}
        />

        <PresetButtons onSelect={setDateRange} />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 self-end text-xs"
            onClick={() => {
              setSelectedTecnicos([]);
              setSelectedStatus(null);
              setDateRange(fallbackRange());
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </Card>
  );
}

export default FilterBarPreventivas;
