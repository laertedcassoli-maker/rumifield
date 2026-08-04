import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  type DateRange,
  type PresetKey,
  FilterActions,
  PeriodField,
  PresetShortcuts,
  SingleSelectCombobox,
  TecnicoCombobox,
  parseRange,
  presets,
  rangeForPreset,
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
  const [activePreset, setActivePreset] = useState<PresetKey>(
    defaultPreset === 'ano' ? 'ano_inteiro' : defaultPreset === 'trimestre' ? 'trimestre_atual' : 'mes_atual',
  );

  const applyPreset = (key: Exclude<PresetKey, 'personalizado'>) => {
    setActivePreset(key);
    setDateRange(rangeForPreset(key));
  };


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

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <PeriodField
            range={dateRange}
            onChange={(r) => {
              setDateRange(r);
              setActivePreset('personalizado');
            }}
          />

          <TecnicoCombobox
            technicians={technicians}
            selected={selectedTecnicos}
            onToggle={(id) =>
              setSelectedTecnicos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            onClear={() => setSelectedTecnicos([])}
          />

          <SingleSelectCombobox<ChamadoPriority>
            label="Prioridade"
            placeholder="Todas as prioridades"
            searchPlaceholder="Buscar prioridade..."
            options={PRIORITY_OPTIONS}
            value={selectedPriority}
            onChange={setSelectedPriority}
          />

          <FilterActions
            summary={summary}
            onClear={() => {
              setSelectedTecnicos([]);
              setSelectedPriority(null);
              applyPreset(
                defaultPreset === 'ano' ? 'ano_inteiro' : defaultPreset === 'trimestre' ? 'trimestre_atual' : 'mes_atual',
              );
            }}
          />
        </div>

        <PresetShortcuts active={activePreset} onSelect={applyPreset} />
      </CardContent>
    </Card>
  );
}

export default FilterBarChamados;
