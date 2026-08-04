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

const STORAGE_KEY = 'chamados:filters:v1';

export type ChamadoPriority = 'urgente' | 'alta' | 'media';

const PRIORITY_OPTIONS: { value: ChamadoPriority; label: string }[] = [
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
];

export interface ChamadosFilters {
  dateRange?: DateRange;
  selectedTecnicos: string[];
  selectedPriority: ChamadoPriority | null;
}

interface Props {
  onFilterChange?: (filters: ChamadosFilters) => void;
  defaultPreset?: 'mes' | 'trimestre' | 'ano';
}

export function FilterBarChamados({ onFilterChange, defaultPreset = 'mes' }: Props) {
  const initialPreset = () =>
    defaultPreset === 'ano'
      ? presets.anoInteiro()
      : defaultPreset === 'trimestre'
        ? presets.trimestreAtual()
        : presets.mesAtual();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const r = parseRange(JSON.parse(raw).dateRange);
        if (r) return r;
      }
    } catch { /* ignore */ }
    return initialPreset();
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

  const [selectedPriority, setSelectedPriority] = useState<ChamadoPriority | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.selectedPriority === 'string') return parsed.selectedPriority as ChamadoPriority;
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
        JSON.stringify({ dateRange: serializeRange(dateRange), selectedTecnicos, selectedPriority }),
      );
    } catch { /* ignore */ }
    onFilterChangeRef.current?.({ dateRange, selectedTecnicos, selectedPriority });
  }, [dateRange, selectedTecnicos, selectedPriority]);

  const hasFilters = useMemo(
    () => selectedTecnicos.length > 0 || selectedPriority !== null,
    [selectedTecnicos, selectedPriority],
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

        <SingleSelectPills<ChamadoPriority>
          label="Prioridade"
          options={PRIORITY_OPTIONS}
          value={selectedPriority}
          onChange={setSelectedPriority}
        />

        <PresetButtons onSelect={setDateRange} />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 self-end text-xs"
            onClick={() => {
              setSelectedTecnicos([]);
              setSelectedPriority(null);
              setDateRange(presets.mesAtual());
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </Card>
  );
}

export default FilterBarChamados;
