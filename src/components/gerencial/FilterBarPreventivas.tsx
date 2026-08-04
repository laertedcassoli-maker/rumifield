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
  /** Badge de resumo exibido à direita (ex: "23 rotas"). */
  summary?: React.ReactNode;
}

export function FilterBarPreventivas({ onFilterChange, defaultPreset = 'mes', summary }: Props) {
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

  const [activePreset, setActivePreset] = useState<PresetKey>(
    defaultPreset === 'ano' ? 'ano_inteiro' : defaultPreset === 'trimestre' ? 'trimestre_atual' : 'mes_atual',
  );

  const applyPreset = (key: Exclude<PresetKey, 'personalizado'>) => {
    setActivePreset(key);
    setDateRange(rangeForPreset(key));
  };

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

          <SingleSelectCombobox<FazendaStatus>
            label="Status da fazenda"
            placeholder="Todos os status"
            searchPlaceholder="Buscar status..."
            options={STATUS_OPTIONS}
            value={selectedStatus}
            onChange={setSelectedStatus}
          />

          <FilterActions
            summary={summary}
            onClear={() => {
              setSelectedTecnicos([]);
              setSelectedStatus(null);
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

export default FilterBarPreventivas;
