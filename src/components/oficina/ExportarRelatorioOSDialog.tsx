import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { fetchRelatorioOSConcluidas } from '@/hooks/useRelatorioOSConcluidas';
import { gerarPlanilhaOSConcluidas } from '@/lib/relatorio-os-xlsx';

type Preset = 'mes_atual' | 'mes_anterior' | 'ultimos_3' | 'personalizado';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userName?: string;
  /** Pré-preenchimento (ex.: filtros já ativos no dashboard) */
  initialDe?: Date;
  initialAte?: Date;
  initialClienteIds?: string[];
  initialActivityIds?: string[];
}

function rangeFromPreset(preset: Preset, de: Date, ate: Date): { de: Date; ate: Date } {
  const now = new Date();
  if (preset === 'mes_atual') return { de: startOfMonth(now), ate: endOfMonth(now) };
  if (preset === 'mes_anterior') {
    const prev = subMonths(now, 1);
    return { de: startOfMonth(prev), ate: endOfMonth(prev) };
  }
  if (preset === 'ultimos_3') return { de: startOfMonth(subMonths(now, 2)), ate: endOfMonth(now) };
  return { de, ate };
}

export function ExportarRelatorioOSDialog({
  open,
  onOpenChange,
  userName,
  initialDe,
  initialAte,
  initialClienteIds,
  initialActivityIds,
}: Props) {
  const prevMonth = subMonths(new Date(), 1);
  const hasInitialPeriod = !!(initialDe && initialAte);
  const [preset, setPreset] = useState<Preset>(hasInitialPeriod ? 'personalizado' : 'mes_anterior');
  const [customDe, setCustomDe] = useState<Date>(initialDe ?? startOfMonth(prevMonth));
  const [customAte, setCustomAte] = useState<Date>(initialAte ?? endOfMonth(prevMonth));
  const [clienteIds, setClienteIds] = useState<string[]>(
    (initialClienteIds ?? []).filter((id) => id !== '__none__')
  );
  const [activityIds, setActivityIds] = useState<string[]>(initialActivityIds ?? []);
  const [loading, setLoading] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ['export-os-clientes'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['export-os-atividades'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { de, ate } = rangeFromPreset(preset, customDe, customAte);

  const toggle = (arr: string[], id: string, set: (v: string[]) => void) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const dados = await fetchRelatorioOSConcluidas({
        dataConclusaoDe: de,
        dataConclusaoAte: ate,
        clienteIds: clienteIds.length ? clienteIds : undefined,
        activityIds: activityIds.length ? activityIds : undefined,
      });

      if (dados.ordens.length === 0) {
        toast.warning('Nenhuma OS concluída no período selecionado');
        return;
      }

      gerarPlanilhaOSConcluidas(dados, {
        dataConclusaoDe: de,
        dataConclusaoAte: ate,
        filtroClientes: clientes.filter((c) => clienteIds.includes(c.id)).map((c) => c.nome),
        filtroAtividades: atividades.filter((a) => activityIds.includes(a.id)).map((a) => a.name),
        geradoPor: userName,
      });

      toast.success(
        `Relatório exportado — ${dados.ordens.length} OS concluídas, ${dados.pecasUsadas.length} linhas de peça`
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao exportar relatório');
    } finally {
      setLoading(false);
    }
  };

  const presets: { value: Preset; label: string }[] = [
    { value: 'mes_atual', label: 'Mês atual' },
    { value: 'mes_anterior', label: 'Mês anterior' },
    { value: 'ultimos_3', label: 'Últimos 3 meses' },
    { value: 'personalizado', label: 'Personalizado' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar relatório de OS concluídas</DialogTitle>
          <DialogDescription>
            Gere uma planilha com as OS concluídas e as peças utilizadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={preset === p.value ? 'default' : 'outline'}
                  onClick={() => setPreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {preset === 'personalizado' && (
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 justify-start font-normal">
                      De: {format(customDe, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={customDe}
                      onSelect={(d) => d && setCustomDe(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 justify-start font-normal">
                      Até: {format(customAte, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={customAte}
                      onSelect={(d) => d && setCustomAte(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              O período considera a data de conclusão da OS.
            </p>
            <p className="text-xs text-muted-foreground">
              {format(de, "dd 'de' MMMM yyyy", { locale: ptBR })} — {format(ate, "dd 'de' MMMM yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Clientes (opcional)
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-between font-normal">
                    <span className="truncate">
                      {clienteIds.length ? `${clienteIds.length} selecionado(s)` : 'Todos'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px] pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente.</CommandEmpty>
                      <CommandGroup>
                        {clientes.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.nome}
                            onSelect={() => toggle(clienteIds, c.id, setClienteIds)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                clienteIds.includes(c.id) ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="truncate">{c.nome}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Atividades (opcional)
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-between font-normal">
                    <span className="truncate">
                      {activityIds.length ? `${activityIds.length} selecionada(s)` : 'Todas'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px] pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar atividade..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma atividade.</CommandEmpty>
                      <CommandGroup>
                        {atividades.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={a.name}
                            onSelect={() => toggle(activityIds, a.id, setActivityIds)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                activityIds.includes(a.id) ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="truncate">{a.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Exportar planilha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
