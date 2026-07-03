import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { DetalheOSDialog } from '@/components/oficina/DetalheOSDialog';
import { SaudeAtivosMotores } from '@/components/oficina/SaudeAtivosMotores';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wrench, CheckCircle, Timer, TrendingUp, AlertTriangle, Clock, ChevronLeft, ChevronRight, X, Check, ChevronsUpDown, Calendar as CalendarIcon, Info } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type Granularity = 'semana' | 'mes' | 'trimestre' | 'personalizado';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface WorkOrderRow {
  id: string;
  code: string;
  status: 'aguardando' | 'em_manutencao' | 'concluido';
  created_at: string;
  start_time: string | null;
  end_time: string | null;
  total_time_seconds: number | null;
  created_by_user_id: string | null;
  concluded_by_user_id: string | null;
  assigned_to_user_id: string | null;
  cliente_id: string | null;
  clientes?: { id: string; nome: string } | null;
  activities?: { id: string; name: string; execution_type: string } | null;
  work_order_items?: Array<{
    workshop_item_id: string | null;
    omie_product_id: string | null;
    workshop_items?: {
      unique_code: string | null;
      pecas?: { nome: string } | null;
    } | null;
  }>;
  work_order_parts_used?: Array<{
    omie_product_id: string | null;
    quantity: number | null;
    pecas?: { nome: string } | null;
  }>;
}

function fmtDur(sec: number | null) {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function durationRange(sec: number | null): { label: string; order: number } {
  const h = (sec || 0) / 3600;
  if (h <= 0) return { label: 'Sem registro', order: 0 };
  if (h < 0.5) return { label: '< 30 min', order: 1 };
  if (h < 1) return { label: '30–60 min', order: 2 };
  if (h < 2) return { label: '1–2 h', order: 3 };
  if (h < 4) return { label: '2–4 h', order: 4 };
  return { label: '> 4 h', order: 5 };
}
function InfoTooltip({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-1.5 cursor-help', className)}>
          {children}
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs normal-case tracking-normal">
        <p className="text-xs normal-case tracking-normal font-normal">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}


export default function GestaoOS() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  type Preset = 'mes_atual' | 'trimestre_atual' | 'ano_inteiro' | 'personalizado';


  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(now),
    to: endOfMonth(now),
  });
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(now));
  const [preset, setPreset] = useState<Preset>('mes_atual');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showAllRows, setShowAllRows] = useState(false);
  const [onlyLongLead, setOnlyLongLead] = useState(false);
  const [openDialogOS, setOpenDialogOS] = useState<any | null>(null);
  const [activityComboOpen, setActivityComboOpen] = useState(false);
  const [clientComboOpen, setClientComboOpen] = useState(false);




  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['gestao-os'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          id, code, status, created_at, start_time, end_time,
          total_time_seconds, created_by_user_id, concluded_by_user_id, assigned_to_user_id,
          cliente_id,
          clientes:cliente_id (id, nome),
          activities:activity_id (id, name, execution_type),
          work_order_items (
            workshop_item_id, omie_product_id,
            workshop_items:workshop_item_id (
              unique_code,
              pecas:omie_product_id (nome)
            )
          ),
          work_order_parts_used (omie_product_id, quantity,
            pecas:omie_product_id (nome))
        `)
        .order('created_at', { ascending: false });


      if (error) throw error;
      return (data || []) as unknown as WorkOrderRow[];
    },
  });

  const userIds = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach(wo => {
      if (wo.created_by_user_id) set.add(wo.created_by_user_id);
      if (wo.concluded_by_user_id) set.add(wo.concluded_by_user_id);
      if (wo.assigned_to_user_id) set.add(wo.assigned_to_user_id);
    });
    return Array.from(set);
  }, [workOrders]);

  const { data: profilesMap = {} } = useQuery({
    queryKey: ['gestao-os-profiles', userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', userIds);
      if (error) throw error;
      const map: Record<string, { nome: string | null; email: string | null }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = { nome: p.nome, email: p.email };
      });
      return map;
    },
  });

  void profilesMap;

  const availableActivities = useMemo(() => {
    const map = new Map<string, string>();
    workOrders.forEach(wo => {
      if (wo.activities?.id && wo.activities?.name) {
        map.set(wo.activities.id, wo.activities.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workOrders]);

  const availableClients = useMemo(() => {
    const map = new Map<string, string>();
    workOrders.forEach(wo => {
      const key = wo.cliente_id || '__none__';
      const label = wo.clientes?.nome || 'Sem cliente';
      map.set(key, label);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workOrders]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    // Always offer a useful window around current year
    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
      years.add(y);
    }
    workOrders.forEach(wo => {
      const y = new Date(wo.created_at).getFullYear();
      years.add(y);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [workOrders, currentYear]);



  const filteredOS = useMemo(() => {
    const fromTs = dateRange.from.getTime();
    const toTs = dateRange.to.getTime();
    return workOrders.filter(wo => {
      const t = new Date(wo.created_at).getTime();
      if (t < fromTs || t > toTs) return false;
      if (selectedActivities.length > 0) {
        if (!wo.activities?.id || !selectedActivities.includes(wo.activities.id)) return false;
      }
      if (selectedClients.length > 0) {
        const key = wo.cliente_id || '__none__';
        if (!selectedClients.includes(key)) return false;
      }
      return true;
    });
  }, [workOrders, dateRange, selectedActivities, selectedClients]);


  const periodLabel = useMemo(() => {
    const sameYear = dateRange.from.getFullYear() === dateRange.to.getFullYear();
    if (sameYear) {
      return `${format(dateRange.from, 'dd/MM')} – ${format(dateRange.to, 'dd/MM/yyyy')}`;
    }
    return `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`;
  }, [dateRange]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const today = new Date();
    if (p === 'mes_atual') {
      const from = startOfMonth(today);
      setDateRange({ from, to: endOfMonth(today) });
      setCalendarMonth(from);
    } else if (p === 'trimestre_atual') {
      const q = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), q * 3, 1);
      const to = new Date(today.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
      setDateRange({ from, to });
      setCalendarMonth(from);
    } else if (p === 'ano_inteiro') {
      const from = new Date(today.getFullYear(), 0, 1);
      setDateRange({
        from,
        to: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
      });
      setCalendarMonth(from);
    }
    // 'personalizado' keeps current selection
  };

  const setYear = (year: number) => {
    setCalendarMonth(new Date(year, calendarMonth.getMonth(), 1));
  };

  const shiftYear = (delta: number) => {
    setCalendarMonth(new Date(calendarMonth.getFullYear() + delta, calendarMonth.getMonth(), 1));
  };

  const goToCurrentYear = () => {
    setCalendarMonth(new Date(currentYear, calendarMonth.getMonth(), 1));
  };

  const clearAllFilters = () => {
    const today = new Date();
    const from = startOfMonth(today);
    setPreset('mes_atual');
    setDateRange({ from, to: endOfMonth(today) });
    setCalendarMonth(from);
    setSelectedActivities([]);
    setSelectedClients([]);
  };





  const toggleActivity = (id: string) => {
    setSelectedActivities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };


  const kpis = useMemo(() => {
    const concluded = filteredOS.filter(wo => wo.status === 'concluido');
    const concludedCount = concluded.length;

    const timesSec = concluded.map(wo => wo.total_time_seconds || 0).filter(s => s > 0);
    const avgTimeSec = timesSec.length ? timesSec.reduce((a, b) => a + b, 0) / timesSec.length : 0;
    const avgTimeH = Math.floor(avgTimeSec / 3600);
    const avgTimeMin = Math.round((avgTimeSec % 3600) / 60);
    const avgTimeLabel = timesSec.length
      ? (avgTimeH > 0 ? `${avgTimeH}h ${avgTimeMin}min` : `${avgTimeMin}min`)
      : '—';

    const leadDays = concluded
      .filter(wo => wo.end_time && wo.created_at)
      .map(wo => (new Date(wo.end_time!).getTime() - new Date(wo.created_at).getTime()) / 86400000);
    const avgLead = leadDays.length ? leadDays.reduce((a, b) => a + b, 0) / leadDays.length : 0;
    const avgLeadLabel = leadDays.length ? `${avgLead.toFixed(1)} dias` : '—';

    const longLeadCount = leadDays.filter(d => d > 30).length;
    const totalForPct = filteredOS.length;
    const longLeadPct = totalForPct > 0 ? (longLeadCount / totalForPct) * 100 : 0;

    return { concludedCount, avgTimeLabel, avgLead, avgLeadLabel, longLeadCount, longLeadPct, totalForPct };
  }, [filteredOS]);


  const categorize = (name?: string | null): string => {
    const n = (name || '').toLowerCase();
    if (n.includes('pistola')) return 'Reparo pistola';
    if (n.includes('solenoide')) return 'Solenoide';
    if (n.includes('counter balance')) return 'Counter balance';
    if (n.includes('montagem') || n.includes('preparo')) return 'Montagem / Preparo';
    return 'Outros';
  };

  const CATEGORY_COLORS: Record<string, string> = {
    'Reparo pistola': '#2563EB',
    'Solenoide': '#10B981',
    'Counter balance': '#F59E0B',
    'Montagem / Preparo': '#F97316',
    'Outros': '#94A3B8',
  };

  const volumeByType = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOS.forEach(wo => {
      const cat = categorize(wo.activities?.name);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || '#94A3B8' }))
      .filter(d => d.value > 0);
  }, [filteredOS]);

  const openersTable = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOS.forEach(wo => {
      const key = wo.created_by_user_id || '__unknown__';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([uid, qty]) => {
        const p = (profilesMap as Record<string, { nome: string | null; email: string | null }>)[uid];
        const nome = uid === '__unknown__' ? 'Não informado' : (p?.nome || p?.email || 'Usuário desconhecido');
        return { uid, nome, qty };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [filteredOS, profilesMap]);

  const technicianProductivity = useMemo(() => {
    type Agg = { uid: string; concluidas: number; totalSec: number; countTime: number; emAberto: number };
    const map = new Map<string, Agg>();
    const getAgg = (uid: string): Agg => {
      let a = map.get(uid);
      if (!a) { a = { uid, concluidas: 0, totalSec: 0, countTime: 0, emAberto: 0 }; map.set(uid, a); }
      return a;
    };
    filteredOS.forEach(wo => {
      const tech = wo.assigned_to_user_id
        || (wo.status === 'concluido' ? wo.concluded_by_user_id : null);
      if (!tech) return;
      const a = getAgg(tech);
      if (wo.status === 'concluido') {
        a.concluidas += 1;
        if (wo.total_time_seconds && wo.total_time_seconds > 0) {
          a.totalSec += wo.total_time_seconds;
          a.countTime += 1;
        }
      } else if (wo.status === 'aguardando' || wo.status === 'em_manutencao') {
        a.emAberto += 1;
      }
    });
    const pm = profilesMap as Record<string, { nome: string | null; email: string | null }>;
    return Array.from(map.values())
      .map(a => {
        const p = pm[a.uid];
        const nome = p?.nome || p?.email || 'Usuário desconhecido';
        const avgSec = a.countTime > 0 ? a.totalSec / a.countTime : 0;
        return { ...a, nome, avgSec };
      })
      .sort((x, y) => y.concluidas - x.concluidas || y.emAberto - x.emAberto);
  }, [filteredOS, profilesMap]);

  const osByClient = useMemo(() => {
    type Agg = { clientId: string; nome: string; total: number; concluded: number; leadSum: number; leadCount: number };
    const map = new Map<string, Agg>();
    const getAgg = (id: string, nome: string): Agg => {
      let a = map.get(id);
      if (!a) { a = { clientId: id, nome, total: 0, concluded: 0, leadSum: 0, leadCount: 0 }; map.set(id, a); }
      return a;
    };
    filteredOS.forEach(wo => {
      const key = wo.cliente_id || '__none__';
      const nome = wo.clientes?.nome || 'Sem cliente';
      const a = getAgg(key, nome);
      a.total += 1;
      if (wo.status === 'concluido' && wo.end_time && wo.created_at) {
        a.concluded += 1;
        a.leadSum += (new Date(wo.end_time).getTime() - new Date(wo.created_at).getTime()) / 86400000;
        a.leadCount += 1;
      }
    });
    return Array.from(map.values())
      .map(a => ({ ...a, avgLead: a.leadCount > 0 ? a.leadSum / a.leadCount : 0 }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [filteredOS]);

  const executionTimeHistogram = useMemo(() => {
    const counts = new Map<string, { label: string; order: number; count: number }>();
    filteredOS
      .filter(wo => wo.status === 'concluido' && (wo.total_time_seconds || 0) > 0)
      .forEach(wo => {
        const r = durationRange(wo.total_time_seconds);
        const existing = counts.get(r.label);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(r.label, { ...r, count: 1 });
        }
      });
    return Array.from(counts.values()).sort((a, b) => a.order - b.order);
  }, [filteredOS]);

  const executionTimeByActivity = useMemo(() => {
    type Agg = { name: string; min: number; max: number; count: number };
    const map = new Map<string, Agg>();
    filteredOS
      .filter(wo => wo.status === 'concluido' && (wo.total_time_seconds || 0) > 0)
      .forEach(wo => {
        const name = wo.activities?.name || '—';
        const existing = map.get(name);
        const sec = wo.total_time_seconds!;
        if (existing) {
          existing.min = Math.min(existing.min, sec);
          existing.max = Math.max(existing.max, sec);
          existing.count += 1;
        } else {
          map.set(name, { name, min: sec, max: sec, count: 1 });
        }
      });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredOS]);

  const concludedByMonth = useMemo(() => {


    const counts = new Map<number, number>();
    filteredOS
      .filter(wo => wo.status === 'concluido')
      .forEach(wo => {
        const m = new Date(wo.created_at).getMonth();
        counts.set(m, (counts.get(m) || 0) + 1);
      });
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, total]) => ({ mes: MONTHS[m], total }));
  }, [filteredOS]);

  const pistolaModels = useMemo(() => {
    const counts = new Map<string, number>();
    filteredOS
      .filter(wo => categorize(wo.activities?.name) === 'Reparo pistola')
      .forEach(wo => {
        (wo.work_order_items || []).forEach(it => {
          const nome = it.workshop_items?.pecas?.nome;
          if (nome) counts.set(nome, (counts.get(nome) || 0) + 1);
        });
      });
    const sorted = Array.from(counts.entries())
      .map(([nome, qty]) => ({ nome, qty }))
      .sort((a, b) => b.qty - a.qty);
    const top = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((acc, r) => acc + r.qty, 0);
    const list = restTotal > 0 ? [...top, { nome: '3+ outros modelos', qty: restTotal }] : top;
    const max = Math.max(1, ...list.map(l => l.qty));
    return { list, max };
  }, [filteredOS]);

  const tipoBadge = (name?: string | null): { label: string; cls: string } => {
    const n = (name || '').toLowerCase();
    if (n.includes('pistola') || n.includes('solenoide') || n.includes('counter')) {
      return { label: 'Reparo', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    if (n.includes('montagem') || n.includes('preparo')) {
      return { label: 'Montagem', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    }
    if (n.includes('lavagem')) {
      return { label: 'Lavagem', cls: 'bg-green-100 text-green-700 border-green-200' };
    }
    return { label: 'Outro', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const statusBadge = (status: string): { label: string; cls: string } => {
    switch (status) {
      case 'aguardando':
        return { label: 'Aguardando', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'em_manutencao':
        return { label: 'Em Manutenção', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'concluido':
        return { label: 'Concluído', cls: 'bg-green-100 text-green-700 border-green-200' };
      default:
        return { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };






  const leadDaysOf = (wo: WorkOrderRow) => {
    if (!wo.end_time || !wo.created_at) return null;
    return (new Date(wo.end_time).getTime() - new Date(wo.created_at).getTime()) / 86400000;
  };

  const concludedRows = useMemo(() => {
    return filteredOS
      .filter(wo => wo.status === 'concluido')
      .map(wo => ({ ...wo, _lead: leadDaysOf(wo) }))
      .sort((a, b) => new Date(b.end_time || b.created_at).getTime() - new Date(a.end_time || a.created_at).getTime());
  }, [filteredOS]);

  const displayedRows = useMemo(() => {
    const base = onlyLongLead ? concludedRows.filter(r => (r._lead ?? 0) > 30) : concludedRows;
    return showAllRows ? base : base.slice(0, 10);
  }, [concludedRows, onlyLongLead, showAllRows]);

  const alerts = useMemo(() => {
    const longLead = concludedRows.filter(r => (r._lead ?? 0) > 30);
    const oldest = [...concludedRows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
    const tinyTime = filteredOS.filter(wo => (wo.total_time_seconds ?? 0) > 0 && (wo.total_time_seconds ?? 0) < 60).length;
    return {
      longLeadCount: longLead.length,
      oldest,
      tinyTime,
    };
  }, [concludedRows, filteredOS]);

  const daysOpen = (wo: WorkOrderRow) => {
    return (Date.now() - new Date(wo.created_at).getTime()) / 86400000;
  };

  const statusFunnel = useMemo(() => {
    const counts = { aguardando: 0, em_manutencao: 0, concluido: 0 };
    filteredOS.forEach(wo => {
      if (wo.status === 'aguardando' || wo.status === 'em_manutencao' || wo.status === 'concluido') {
        counts[wo.status]++;
      }
    });
    return counts;
  }, [filteredOS]);

  const openAgeStats = useMemo(() => {
    const open = filteredOS.filter(wo => wo.status === 'aguardando' || wo.status === 'em_manutencao');
    const days = open.map(wo => daysOpen(wo));
    const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    return { count: open.length, avgDays: avg };
  }, [filteredOS]);

  const oldestOpenRows = useMemo(() => {
    return filteredOS
      .filter(wo => wo.status !== 'concluido')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 5);
  }, [filteredOS]);


  // Possível retrabalho: mesma peça usada no mesmo ativo em OS distintas dentro de 90 dias
  const reworkRows = useMemo(() => {
    const WINDOW_DAYS = 90;
    type Occ = { woId: string; woCode: string; assetCode: string; partName: string; createdAt: number };
    // Chave: assetId::partId
    const groups = new Map<string, Occ[]>();

    workOrders.forEach(wo => {
      const created = new Date(wo.created_at).getTime();
      const items = wo.work_order_items || [];
      const parts = wo.work_order_parts_used || [];
      if (!items.length || !parts.length) return;
      items.forEach(it => {
        if (!it.workshop_item_id) return;
        const assetCode = it.workshop_items?.unique_code || '—';
        parts.forEach(p => {
          if (!p.omie_product_id) return;
          const key = `${it.workshop_item_id}::${p.omie_product_id}`;
          const arr = groups.get(key) || [];
          // Evita contar duas vezes se a mesma peça aparece em múltiplos itens da mesma OS
          if (!arr.some(o => o.woId === wo.id)) {
            arr.push({
              woId: wo.id,
              woCode: wo.code,
              assetCode,
              partName: p.pecas?.nome || p.omie_product_id,
              createdAt: created,
            });
            groups.set(key, arr);
          }
        });
      });
    });

    const filteredIds = new Set(filteredOS.map(wo => wo.id));
    const result: Array<{
      key: string;
      assetCode: string;
      partName: string;
      count: number;
      codes: string[];
      spanDays: number;
    }> = [];

    groups.forEach((occs, key) => {
      if (occs.length < 2) return;
      occs.sort((a, b) => a.createdAt - b.createdAt);
      // Janela deslizante de 90 dias
      let bestWindow: Occ[] = [];
      for (let i = 0; i < occs.length; i++) {
        const window: Occ[] = [occs[i]];
        for (let j = i + 1; j < occs.length; j++) {
          if ((occs[j].createdAt - occs[i].createdAt) / 86400000 <= WINDOW_DAYS) {
            window.push(occs[j]);
          } else break;
        }
        if (window.length >= 2 && window.length > bestWindow.length) bestWindow = window;
      }
      if (bestWindow.length < 2) return;
      // Considera apenas se a OS mais recente da janela está no período filtrado
      const mostRecent = bestWindow[bestWindow.length - 1];
      if (!filteredIds.has(mostRecent.woId)) return;
      const spanDays = Math.round(
        (bestWindow[bestWindow.length - 1].createdAt - bestWindow[0].createdAt) / 86400000
      );
      result.push({
        key,
        assetCode: bestWindow[0].assetCode,
        partName: bestWindow[0].partName,
        count: bestWindow.length,
        codes: bestWindow.map(o => o.woCode),
        spanDays,
      });
    });

    return result.sort((a, b) => b.count - a.count || a.spanDays - b.spanDays);
  }, [workOrders, filteredOS]);


  const renderOsByClientTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b">
            <th className="text-left font-medium py-2 px-3">Cliente</th>
            <th className="text-right font-medium py-2 px-3">Quantidade OS</th>
            <th className="text-right font-medium py-2 px-3">Lead time médio</th>
          </tr>
        </thead>
        <tbody>
          {osByClient.map((row, i) => (
            <tr key={row.clientId} className={cn('border-b last:border-b-0', i % 2 === 1 && 'bg-muted/30')}>
              <td className="py-2 px-3">
                <div className="truncate max-w-[300px]">{row.nome}</div>
              </td>
              <td className="py-2 px-3 text-right font-medium tabular-nums">{row.total}</td>
              <td className={cn(
                'py-2 px-3 text-right font-medium tabular-nums',
                row.avgLead > 30 ? 'text-red-600' : row.avgLead >= 7 ? 'text-orange-500' : 'text-green-600'
              )}>
                {row.concluded > 0 ? `${row.avgLead.toFixed(1)} dias` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="h-7 w-7 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Oficina · Gestão de OS</h1>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Período */}
            <div className="flex flex-col gap-1 min-w-[240px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">Período</span>
              <div className="flex items-center gap-1.5">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 justify-start text-left font-normal min-w-[220px]">
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {periodLabel}
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
                            {availableYears.map(year => (
                              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftYear(1)} aria-label="Próximo ano">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToCurrentYear}>
                        Ano atual
                      </Button>
                    </div>
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({
                            from: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0, 0),
                            to: new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999),
                          });
                          setPreset('personalizado');
                        } else if (range?.from) {
                          setDateRange({
                            from: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0, 0),
                            to: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 23, 59, 59, 999),
                          });
                          setPreset('personalizado');
                        }
                      }}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Atividade */}
            <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[260px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">Atividade</span>
              <Popover open={activityComboOpen} onOpenChange={setActivityComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 justify-between font-normal">
                    <span className="truncate">
                      {selectedActivities.length === 0
                        ? 'Todas as atividades'
                        : `${selectedActivities.length} selecionado(s)`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar atividade..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma atividade.</CommandEmpty>
                      <CommandGroup>
                        {availableActivities.map(a => {
                          const active = selectedActivities.includes(a.id);
                          return (
                            <CommandItem key={a.id} value={a.name} onSelect={() => toggleActivity(a.id)}>
                              <Check className={cn('mr-2 h-4 w-4', active ? 'opacity-100' : 'opacity-0')} />
                              {a.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Cliente */}
            <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-[260px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">Cliente</span>
              <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 justify-between font-normal">
                    <span className="truncate">
                      {selectedClients.length === 0
                        ? 'Todos os clientes'
                        : `${selectedClients.length} selecionado(s)`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente.</CommandEmpty>
                      <CommandGroup>
                        {availableClients.map(c => {
                          const active = selectedClients.includes(c.id);
                          return (
                            <CommandItem key={c.id} value={c.name} onSelect={() => toggleClient(c.id)}>
                              <Check className={cn('mr-2 h-4 w-4', active ? 'opacity-100' : 'opacity-0')} />
                              {c.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 ml-auto pb-0.5">
              <Badge variant="secondary" className="h-7 whitespace-nowrap">
                {filteredOS.length} OS
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            </div>
          </div>

          {/* Atalhos de período */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Atalhos:</span>
            {([
              { key: 'mes_atual', label: 'Mês atual' },
              { key: 'trimestre_atual', label: 'Trimestre atual' },
              { key: 'ano_inteiro', label: 'Ano inteiro' },
            ] as Array<{ key: Preset; label: string }>).map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  'text-[11px] font-medium transition-colors',
                  preset === p.key
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>




      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* OS Concluídas */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <InfoTooltip text="quantidade de ordens de serviço com status 'concluído' dentro do período e tipos de atividade selecionados nos filtros.">OS Concluídas</InfoTooltip>
            </p>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-green-600">{kpis.concludedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">no período</p>
        </div>

        {/* Tempo médio / OS */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <InfoTooltip text="média do tempo de execução (campo total_time_seconds) das OS concluídas no período filtrado. OS sem tempo registrado (zero ou nulo) não entram nessa média.">Tempo médio / OS</InfoTooltip>
            </p>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-3xl font-bold">{kpis.avgTimeLabel}</p>
          <p className="text-xs text-muted-foreground mt-1">por OS concluída</p>
        </div>

        {/* Lead time médio */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <InfoTooltip text="média, em dias, do intervalo entre a abertura (created_at) e a conclusão (end_time) das OS concluídas no período filtrado. só considera OS que têm data de conclusão registrada. verde quando a média é de até 10 dias, laranja quando ultrapassa 10 dias.">Lead time médio</InfoTooltip>
            </p>
            <TrendingUp className={cn('h-4 w-4', kpis.avgLead > 10 ? 'text-orange-500' : 'text-green-600')} />
          </div>
          <p className={cn('mt-2 text-3xl font-bold', kpis.avgLead > 10 ? 'text-orange-500' : 'text-green-600')}>
            {kpis.avgLeadLabel}
          </p>
          <p className="text-xs text-muted-foreground mt-1">abertura → conclusão</p>
        </div>

        {/* OS com lead time > 30 dias */}
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <InfoTooltip text="quantidade e percentual de OS cujo lead time (tempo entre abertura e conclusão) ultrapassou 30 dias. o percentual é calculado sobre o total de OS do período filtrado (incluindo as que ainda não foram concluídas), não apenas sobre as concluídas. verde abaixo de 5%, laranja entre 5% e 10%, vermelho acima de 10%.">Lead time &gt; 30 dias</InfoTooltip>
            </p>
            <AlertTriangle className={cn(
              'h-4 w-4',
              kpis.longLeadPct > 10 ? 'text-red-600' : kpis.longLeadPct >= 5 ? 'text-orange-500' : 'text-green-600'
            )} />
          </div>
          <p className={cn(
            'mt-2 text-3xl font-bold',
            kpis.longLeadPct > 10 ? 'text-red-600' : kpis.longLeadPct >= 5 ? 'text-orange-500' : 'text-green-600'
          )}>
            {kpis.longLeadCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.totalForPct > 0 ? `${kpis.longLeadPct.toFixed(0)}% do total` : '—'}
          </p>
        </div>
      </div>

      {/* Funil de Status das OS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <InfoTooltip text="Mostra a distribuição das OS do período e filtros selecionados entre os três status possíveis: Aguardando, Em Manutenção e Concluído.">
              Funil de Status das OS
            </InfoTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Aguardando */}
            <div className="rounded-xl border shadow-sm p-5 bg-card">
              <div className="flex items-center justify-between">
                <InfoTooltip text="Quantidade de OS com status 'aguardando' dentro do período e filtros selecionados — ainda não iniciadas.">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aguardando</p>
                </InfoTooltip>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-600">{statusFunnel.aguardando}</p>
              <p className="text-xs text-muted-foreground mt-1">OS pendentes</p>
            </div>

            {/* Em Manutenção */}
            <div className="rounded-xl border shadow-sm p-5 bg-card">
              <div className="flex items-center justify-between">
                <InfoTooltip text="Quantidade de OS com status 'em_manutencao' dentro do período e filtros selecionados — atualmente em execução.">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Em Manutenção</p>
                </InfoTooltip>
                <Wrench className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-blue-600">{statusFunnel.em_manutencao}</p>
              <p className="text-xs text-muted-foreground mt-1">OS em execução</p>
            </div>

            {/* Concluído */}
            <div className="rounded-xl border shadow-sm p-5 bg-card">
              <div className="flex items-center justify-between">
                <InfoTooltip text="Quantidade de OS com status 'concluido' dentro do período e filtros selecionados.">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concluído</p>
                </InfoTooltip>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-green-600">{statusFunnel.concluido}</p>
              <p className="text-xs text-muted-foreground mt-1">OS finalizadas</p>
            </div>

            {/* Idade média das OS em aberto */}
            <div className="rounded-xl border shadow-sm p-5 bg-card">
              <div className="flex items-center justify-between">
                <InfoTooltip text="Média de dias desde a abertura (created_at) até hoje, considerando apenas as OS com status 'aguardando' ou 'em_manutencao' no período filtrado. Verde até 7 dias, laranja de 7 a 30 dias, vermelho acima de 30 dias.">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Idade média das OS em aberto</p>
                </InfoTooltip>
                <Timer className={cn(
                  'h-4 w-4',
                  openAgeStats.avgDays > 30 ? 'text-red-600' : openAgeStats.avgDays >= 7 ? 'text-orange-500' : 'text-green-600'
                )} />
              </div>
              <p className={cn(
                'mt-2 text-3xl font-bold',
                openAgeStats.avgDays > 30 ? 'text-red-600' : openAgeStats.avgDays >= 7 ? 'text-orange-500' : 'text-green-600'
              )}>
                {openAgeStats.count > 0 ? `${openAgeStats.avgDays.toFixed(1)} dias` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {openAgeStats.count > 0 ? `${openAgeStats.count} OS em aberto` : 'nenhuma OS em aberto no período'}
              </p>
            </div>
          </div>

          {/* 5 OS mais antigas em aberto */}
          <div>
            <h3 className="text-sm font-semibold mb-3">
              <InfoTooltip text="Lista as 5 OS com status diferente de 'concluido' com a data de abertura (created_at) mais antiga, dentro do período filtrado. Não considera OS já concluídas.">
                5 OS mais antigas em aberto
              </InfoTooltip>
            </h3>
            {oldestOpenRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma OS em aberto no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 px-3">Código</th>
                      <th className="text-left font-medium py-2 px-3">Atividade</th>
                      <th className="text-left font-medium py-2 px-3">Status</th>
                      <th className="text-right font-medium py-2 px-3">
                        <InfoTooltip text="Dias corridos desde a abertura da OS até hoje. Mesma escala de cores da 'Idade média das OS em aberto' (verde até 7 dias, laranja até 30, vermelho acima de 30).">
                          Dias em aberto
                        </InfoTooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {oldestOpenRows.map((row, i) => {
                      const s = statusBadge(row.status);
                      const d = daysOpen(row);
                      return (
                        <tr key={row.id} className={cn('border-b last:border-b-0', i % 2 === 1 && 'bg-muted/30')}>
                          <td className="py-2 px-3">
                            <button onClick={() => setOpenDialogOS(row)} className="text-blue-600 hover:underline font-medium">
                              {row.code}
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            <div className="truncate max-w-[260px]">{row.activities?.name || '—'}</div>
                          </td>
                          <td className="py-2 px-3">
                            <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-medium', s.cls)}>
                              {s.label}
                            </span>
                          </td>
                          <td className={cn(
                            'py-2 px-3 text-right font-medium tabular-nums',
                            d > 30 ? 'text-red-600' : d >= 7 ? 'text-orange-500' : 'text-green-600'
                          )}>
                            {d.toFixed(0)} dias
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OS por Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">OS por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {osByClient.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Sem OS por cliente no período.</p>
          ) : osByClient.length > 5 ? (
            <Accordion type="single" collapsible defaultValue="os-por-cliente">
              <AccordionItem value="os-por-cliente" className="border-0">
                <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
                  {osByClient.length} clientes no período
                </AccordionTrigger>
                <AccordionContent>{renderOsByClientTable()}</AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            renderOsByClientTable()
          )}
        </CardContent>
      </Card>

      {/* Distribuição do Tempo de Execução */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">Distribuição do Tempo de Execução</h3>
          {executionTimeHistogram.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem OS concluídas com tempo registrado no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={executionTimeHistogram} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RTooltip formatter={(v: number) => [`${v} OS`, 'Quantidade']} />
                  <Bar dataKey="count" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">Tempo de Execução por Atividade</h3>
          {executionTimeByActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem OS concluídas com tempo registrado no período.</p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left font-medium py-2 px-3">Atividade</th>
                    <th className="text-right font-medium py-2 px-3">Mínimo</th>
                    <th className="text-right font-medium py-2 px-3">Máximo</th>
                    <th className="text-right font-medium py-2 px-3">OS</th>
                  </tr>
                </thead>
                <tbody>
                  {executionTimeByActivity.map((row, i) => (
                    <tr key={row.name} className={cn(i % 2 === 1 && 'bg-muted/40')}>
                      <td className="py-2 px-3">
                        <div className="truncate max-w-[220px]">{row.name}</div>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtDur(row.min)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtDur(row.max)}</td>
                      <td className="py-2 px-3 text-right font-medium tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Volume por Tipo + Responsável Abertura */}



      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">
            <InfoTooltip text="distribui as OS do período filtrado em categorias definidas pelo nome da atividade: reparo pistola, solenoide, counter balance, montagem/preparo e outros. a categorização é feita por palavras-chave no nome da atividade, não por um campo de categoria dedicado.">Volume por Tipo de OS</InfoTooltip>
          </h3>
          {volumeByType.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={volumeByType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {volumeByType.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: number, n: string) => [`${v} OS`, n]} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">
            <InfoTooltip text="quantidade de OS abertas por cada usuário (campo created_by_user_id), dentro do período e filtros selecionados.">Responsável Abertura</InfoTooltip>
          </h3>
          {openersTable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="overflow-hidden rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left font-medium py-2 px-3">Nome</th>
                    <th className="text-right font-medium py-2 px-3">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {openersTable.map((row, i) => (
                    <tr key={row.uid} className={cn(i % 2 === 1 && 'bg-muted/40')}>
                      <td className="py-2 px-3">{row.nome}</td>
                      <td className="py-2 px-3 text-right font-medium tabular-nums">{row.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Produtividade por Técnico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtividade por Técnico</CardTitle>
        </CardHeader>
        <CardContent>
          {technicianProductivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Sem OS atribuídas a técnicos no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 px-3">Técnico</th>
                    <th className="text-right font-medium py-2 px-3">OS concluídas</th>
                    <th className="text-right font-medium py-2 px-3">Tempo médio exec.</th>
                    <th className="text-right font-medium py-2 px-3">OS em aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianProductivity.map((row, i) => (
                    <tr key={row.uid} className={cn('border-b last:border-b-0', i % 2 === 1 && 'bg-muted/30')}>
                      <td className="py-2 px-3">{row.nome}</td>
                      <td className="py-2 px-3 text-right font-medium tabular-nums">{row.concluidas}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtDur(row.avgSec > 0 ? row.avgSec : null)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {row.emAberto > 0 ? (
                          <span className="inline-block rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs font-semibold">
                            {row.emAberto}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>



      {/* OS por mês + Tipos de pistola */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">
            <InfoTooltip text="quantidade de OS com status 'concluído', agrupadas pelo mês da data de abertura (created_at) — não pelo mês de conclusão.">OS Concluídas por Mês</InfoTooltip>
          </h3>
          {concludedByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concludedByMonth} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RTooltip formatter={(v: number) => [`${v} OS`, 'Total']} />
                  <Bar dataKey="total" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border shadow-sm p-5 bg-card">
          <h3 className="text-sm font-semibold mb-3">
            <InfoTooltip text="ranking das peças mais registradas em OS da categoria 'reparo pistola', contando os itens vinculados (work_order_items) a essas OS. mostra os 5 modelos mais frequentes; os demais são agrupados em '3+ outros modelos'.">Tipos de Pistola Reparada</InfoTooltip>
          </h3>
          {pistolaModels.list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem reparos de pistola no período.</p>
          ) : (
            <div className="space-y-3">
              {pistolaModels.list.map((m) => {
                const pct = (m.qty / pistolaModels.max) * 100;
                return (
                  <div key={m.nome} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2">{m.nome}</span>
                      <span className="font-medium tabular-nums">{m.qty}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: '#2563EB' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabela: Últimas OS Concluídas */}
      <Accordion type="single" collapsible defaultValue="ultimas-os-concluidas">
        <AccordionItem value="ultimas-os-concluidas" className="border-0">
          <div className="rounded-xl border shadow-sm p-5 bg-card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <AccordionTrigger className="text-sm font-semibold py-0 hover:no-underline w-full basis-full">
                <div className="flex flex-1 items-center gap-2">
                  <InfoTooltip text="lista as OS concluídas no período filtrado, ordenadas pela data de conclusão (ou abertura, se não houver data de conclusão) mais recente primeiro. por padrão mostra as 10 últimas; use 'ver todas' para exibir a lista completa.">
                    Últimas OS Concluídas
                  </InfoTooltip>
                  {onlyLongLead && <span className="text-xs text-red-600 font-normal">· filtro: Lead {'>'} 30d</span>}
                </div>
              </AccordionTrigger>
              {onlyLongLead && (
                <Button variant="ghost" size="sm" onClick={() => setOnlyLongLead(false)}>
                  Limpar filtro
                </Button>
              )}
            </div>

            <AccordionContent>
              {displayedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">Sem OS concluídas no período.</p>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                          <th className="text-left font-medium py-2 px-3">Código</th>
                          <th className="text-left font-medium py-2 px-3">Atividade / Item</th>
                          <th className="text-left font-medium py-2 px-3">Tipo</th>
                          <th className="text-left font-medium py-2 px-3">Abertura</th>
                          <th className="text-left font-medium py-2 px-3">Conclusão</th>
                          <th className="text-left font-medium py-2 px-3">
                            <InfoTooltip text="tempo total registrado de execução da OS (campo total_time_seconds), formatado em horas e minutos.">Tempo Exec.</InfoTooltip>
                          </th>
                          <th className="text-left font-medium py-2 px-3">
                            <InfoTooltip text="dias entre abertura e conclusão da OS. destacado em vermelho quando ultrapassa 30 dias.">Lead Time</InfoTooltip>
                          </th>
                          <th className="text-left font-medium py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((row, i) => {
                          const t = tipoBadge(row.activities?.name);
                          const lead = row._lead;
                          const leadColor = lead == null ? 'text-muted-foreground'
                            : lead > 30 ? 'text-red-600 font-semibold'
                            : lead >= 7 ? 'text-orange-500 font-medium'
                            : 'text-green-600 font-medium';
                          const itemCode = row.work_order_items?.[0]?.workshop_items?.unique_code;
                          return (
                            <tr key={row.id} className={cn('border-b last:border-b-0', i % 2 === 1 && 'bg-muted/30')}>
                              <td className="py-2 px-3">
                                <button onClick={() => setOpenDialogOS(row)} className="text-blue-600 hover:underline font-medium">
                                  {row.code}
                                </button>
                              </td>
                              <td className="py-2 px-3">
                                <div className="truncate max-w-[260px]">{row.activities?.name || '—'}</div>
                                {itemCode && <div className="text-xs text-muted-foreground">{itemCode}</div>}
                              </td>
                              <td className="py-2 px-3">
                                <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-medium', t.cls)}>{t.label}</span>
                              </td>
                              <td className="py-2 px-3 tabular-nums">{format(new Date(row.created_at), 'dd/MM/yy')}</td>
                              <td className="py-2 px-3 tabular-nums">{row.end_time ? format(new Date(row.end_time), 'dd/MM/yy') : '—'}</td>
                              <td className="py-2 px-3 tabular-nums">{fmtDur(row.total_time_seconds)}</td>
                              <td className={cn('py-2 px-3 tabular-nums', leadColor)}>
                                {lead == null ? '—' : `${lead.toFixed(1)} dias`}
                                {lead != null && lead > 30 && (
                                  <span className="ml-2 inline-block rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-semibold">
                                    Lead alto
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-block rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
                                  Concluída
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {displayedRows.map(row => {
                      const t = tipoBadge(row.activities?.name);
                      const lead = row._lead;
                      const leadColor = lead == null ? 'text-muted-foreground'
                        : lead > 30 ? 'text-red-600 font-semibold'
                        : lead >= 7 ? 'text-orange-500 font-medium'
                        : 'text-green-600 font-medium';
                      const itemCode = row.work_order_items?.[0]?.workshop_items?.unique_code;
                      return (
                        <div key={row.id} className="rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <button onClick={() => setOpenDialogOS(row)} className="text-blue-600 hover:underline font-medium">
                              {row.code}
                            </button>
                            <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs font-medium', t.cls)}>{t.label}</span>
                          </div>
                          <div className="text-sm">{row.activities?.name || '—'}</div>
                          {itemCode && <div className="text-xs text-muted-foreground">{itemCode}</div>}
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                            <div>Abertura: <span className="text-foreground">{format(new Date(row.created_at), 'dd/MM/yy')}</span></div>
                            <div>Conclusão: <span className="text-foreground">{row.end_time ? format(new Date(row.end_time), 'dd/MM/yy') : '—'}</span></div>
                            <div>Tempo: <span className="text-foreground">{fmtDur(row.total_time_seconds)}</span></div>
                            <div>Lead: <span className={leadColor}>{lead == null ? '—' : `${lead.toFixed(1)}d`}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(onlyLongLead ? concludedRows.filter(r => (r._lead ?? 0) > 30).length : concludedRows.length) > 10 && (
                    <div className="flex justify-center mt-4">
                      <Button variant="outline" size="sm" onClick={() => setShowAllRows(v => !v)}>
                        {showAllRows
                          ? 'Mostrar menos'
                          : `Ver todas (${onlyLongLead ? concludedRows.filter(r => (r._lead ?? 0) > 30).length : concludedRows.length})`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </AccordionContent>
          </div>
        </AccordionItem>
      </Accordion>

      {/* Alertas e Pontos de Atenção */}
      <div className="grid grid-cols-1 md:grid-cols-2 md:justify-items-end">
        <div className="rounded-xl border shadow-sm p-5 bg-card md:col-start-2 w-full">
          <h3 className="text-sm font-semibold mb-3">Alertas e Pontos de Atenção</h3>
          <p className="text-xs text-muted-foreground mb-3">Clique nos itens para filtrar a tabela abaixo.</p>
          <ul className="space-y-2 text-sm">
            <li>
              <button
                onClick={() => { setOnlyLongLead(true); setShowAllRows(true); }}
                className="w-full flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/40 text-left"
              >
                <InfoTooltip text="clique para filtrar a tabela abaixo e ver somente as OS que levaram mais de 30 dias entre abertura e conclusão.">OS com lead time acima de 30 dias</InfoTooltip>
                <span className="inline-block rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-semibold">
                  {alerts.longLeadCount}
                </span>
              </button>
            </li>
            <li className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground mb-0.5">
                <InfoTooltip text="a OS concluída com a data de abertura (created_at) mais antiga dentro do período filtrado.">OS mais antiga concluída</InfoTooltip>
              </div>
              <div className="text-sm">
                {alerts.oldest
                  ? `${alerts.oldest.code} · aberta ${format(new Date(alerts.oldest.created_at), 'dd/MM')}`
                  : '—'}
              </div>
            </li>
            <li className="rounded-md border px-3 py-2 flex items-center justify-between">
              <InfoTooltip text="quantidade de OS com tempo de execução maior que zero mas menor que 1 minuto — geralmente indica um apontamento de tempo feito incorretamente.">OS com tempo registrado &lt; 1 min</InfoTooltip>
              <span className="text-xs text-muted-foreground">~{alerts.tinyTime} registros</span>
            </li>
          </ul>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Possível Retrabalho
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Mesma peça usada no mesmo ativo em OS diferentes dentro de 90 dias (OS mais recente no período filtrado).
          </p>
        </CardHeader>
        <CardContent>
          {reworkRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum caso detectado no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Ativo</th>
                    <th className="py-2 pr-3">Peça</th>
                    <th className="py-2 pr-3 text-right">Repetições</th>
                    <th className="py-2 pr-3">OS envolvidas</th>
                    <th className="py-2 pr-3 text-right">Intervalo (dias)</th>
                  </tr>
                </thead>
                <tbody>
                  {reworkRows.slice(0, 20).map(r => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.assetCode}</td>
                      <td className="py-2 pr-3">{r.partName}</td>
                      <td className="py-2 pr-3 text-right">
                        <Badge className={cn(
                          'text-white',
                          r.count >= 3 ? 'bg-red-600 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-500'
                        )}>
                          {r.count}x
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs">{r.codes.join(', ')}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.spanDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>


      <Accordion type="single" collapsible defaultValue="saude-ativos">
        <AccordionItem value="saude-ativos" className="border-0">
          <section className="rounded-xl border shadow-sm p-5 bg-card space-y-3">
            <AccordionTrigger className="text-lg font-semibold py-0 hover:no-underline">
              <div className="text-left">
                <h2 className="text-lg font-semibold">Saúde de Ativos / Motores</h2>
                <p className="text-xs text-muted-foreground">Visão do estado atual dos ativos — independente dos filtros de período/atividade.</p>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <SaudeAtivosMotores />
            </AccordionContent>
          </section>
        </AccordionItem>
      </Accordion>

      {openDialogOS && (
        <DetalheOSDialog
          open={!!openDialogOS}
          onOpenChange={(o) => { if (!o) setOpenDialogOS(null); }}
          workOrder={openDialogOS as any}
          onUpdate={() => { /* read-only context */ }}
        />
      )}


      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando dados…</p>
      )}
    </div>
    </TooltipProvider>
  );
}
