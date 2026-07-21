import { useState, useEffect, useCallback } from "react";
import { Brain, ClipboardCheck, AlertTriangle, Eye, FileText, AudioLines, Package, Sparkles, ChevronDown, ChevronUp, Loader2, Search, Cpu, Wrench, Timer, Repeat2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import ReactMarkdown from "react-markdown";

const AI_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Rápido e eficiente" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", description: "Próxima geração" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Raciocínio complexo" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Equilibrado" },
  { value: "openai/gpt-5", label: "GPT-5", description: "Alta precisão" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", description: "Custo-benefício" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", description: "Mais recente OpenAI" },
];

const SUGGESTIONS_CLIENT = [
  { icon: "📋", label: "Resumo completo", question: "Faça um resumo completo deste cliente" },
  { icon: "⚠️", label: "Pendências", question: "Quais são as pendências e alertas?" },
  { icon: "🔧", label: "Problemas recorrentes", question: "Quais os problemas recorrentes nas preventivas?" },
  { icon: "📊", label: "Saúde CRM", question: "Como está a saúde comercial no CRM?" },
  { icon: "🎯", label: "Histórico comercial", question: "Qual o histórico de visitas comerciais e o que foi discutido?" },
  { icon: "📦", label: "Peças + frequência", question: "Quais peças são mais consumidas e com que frequência?" },
  { icon: "🎙️", label: "Transcrições", question: "Resuma as transcrições de áudio das últimas visitas" },
  { icon: "📝", label: "Propostas", question: "Qual a situação das propostas comerciais?" },
];

const SUGGESTIONS_ALL = [
  { icon: "🚨", label: "Atenção urgente", question: "Quais clientes precisam de atenção urgente?" },
  { icon: "🔧", label: "Chamados abertos", question: "Resumo de chamados abertos por cliente" },
  { icon: "📅", label: "Preventivas atrasadas", question: "Quais clientes estão com preventivas atrasadas?" },
  { icon: "📊", label: "Pipeline comercial", question: "Visão geral do pipeline comercial" },
  { icon: "📦", label: "Pedidos pendentes", question: "Quais clientes têm pedidos pendentes?" },
  { icon: "📋", label: "Resumo geral", question: "Faça um resumo geral de todos os clientes" },
];

const SUGGESTIONS_OFICINA = [
  { icon: "📈", label: "Volume e lead time", question: "Qual foi o volume de OS e o lead time médio no período? Compare por atividade." },
  { icon: "⏱️", label: "Tempo por atividade", question: "Qual o tempo médio, mínimo e máximo de execução por tipo de atividade?" },
  { icon: "🔁", label: "Retrabalho", question: "Onde está havendo retrabalho? Aponte ativo, peça, quantas vezes e intervalos." },
  { icon: "🧩", label: "Peças na oficina", question: "Quais são as peças mais consumidas em OS no período?" },
  { icon: "⚙️", label: "Motores em risco", question: "Quais motores estão em nível crítico (>1000h) ou de atenção (>800h)?" },
  { icon: "🚨", label: "OS em aberto antigas", question: "Quais são as OS em aberto há mais tempo e o que elas têm em comum?" },
];


const ALL_CLIENTS_OPTION: ClientOption = {
  id: "all",
  nome: "Todos os clientes",
  fazenda: null,
  cidade: null,
  estado: null,
};

interface ClientOption {
  id: string;
  nome: string;
  fazenda: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Stats {
  total_preventivas: number;
  preventivas_por_status: Record<string, number>;
  ultima_preventiva: string | null;
  ultima_concluida: string | null;
  top_nao_conformidades: { label: string; count: number }[];
  top_acoes_corretivas: { label: string; count: number }[];
  top_pecas: { label: string; total: number }[];
  total_chamados: number;
  chamados_abertos: { code: string; title: string; priority: string; status: string }[];
  chamados_por_status: Record<string, number>;
  chamados_por_prioridade: Record<string, number>;
  tempo_medio_resolucao: number | null;
  tags_frequentes: { label: string; count: number }[];
  total_visitas_crm: number;
  audios_gravados: number;
  audios_transcritos: number;
  transcricoes_recentes: { date: string; text: string; summary: string[] | null }[];
  total_propostas: number;
  propostas_por_status: Record<string, number>;
  total_pecas_consumidas: number;
  acoes_crm_recentes: { title: string; status: string; type: string; due_at: string | null; priority: number }[];
  pedidos_por_status: Record<string, number>;
  pedidos_pendentes: { id: string; created_at: string }[];
  produtos_crm: { product_code: string; stage: string; value_estimated: number | null; probability: number | null }[];
}

export default function CrmInteligencia() {
  const { role } = useAuth();
  const { canAccess, isLoading: permissionsLoading } = useMenuPermissions();
  const { toast } = useToast();

  const [scope, setScope] = useState<"client" | "oficina">("client");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [question, setQuestion] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "collecting" | "analyzing">("idle");
  const [stats, setStats] = useState<any | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cachedKey, setCachedKey] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-flash-preview");

  // Oficina filters
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [activities, setActivities] = useState<{ id: string; name: string }[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  // Check permissions
  const allowed =
    role === "admin" ||
    role === "coordenador_servicos" ||
    role === "coordenador_rplus" ||
    canAccess("crm_inteligencia");

  // Search clients
  useEffect(() => {
    const fetchClients = async () => {
      const query = supabase
        .from("clientes")
        .select("id, nome, fazenda, cidade, estado")
        .eq("status", "ativo")
        .order("nome")
        .limit(50);

      if (clientSearch.length >= 2) {
        query.or(`nome.ilike.%${clientSearch}%,fazenda.ilike.%${clientSearch}%`);
      }

      const { data } = await query;
      setClients((data as ClientOption[]) || []);
    };
    fetchClients();
  }, [clientSearch]);

  // Load activities for oficina filter
  useEffect(() => {
    if (scope !== "oficina") return;
    (async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, name")
        .order("name");
      setActivities((data as any[]) || []);
    })();
  }, [scope]);

  const toggleActivity = (id: string) =>
    setSelectedActivities((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleGenerate = useCallback(async () => {
    if (scope === "client" && !selectedClient) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    if (!question.trim()) {
      toast({ title: "Digite uma pergunta", variant: "destructive" });
      return;
    }

    const key =
      scope === "oficina"
        ? `oficina:${dateFrom}:${dateTo}:${selectedActivities.slice().sort().join(",")}`
        : `client:${selectedClient?.id}`;
    const reuseStats = cachedKey === key && stats;

    setLoadingPhase(reuseStats ? "analyzing" : "collecting");
    setAnalysis(null);

    try {
      const body: any = { question: question.trim(), model: selectedModel, scope };
      if (scope === "client") body.clientId = selectedClient!.id;
      if (scope === "oficina") {
        body.filters = {
          dateFrom: dateFrom || null,
          dateTo: dateTo ? `${dateTo}T23:59:59` : null,
          activityIds: selectedActivities,
        };
      }
      const { data, error } = await supabase.functions.invoke("client-intelligence", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setStats(data.stats);
      setCachedKey(key);
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao gerar análise", variant: "destructive" });
    } finally {
      setLoadingPhase("idle");
    }
  }, [scope, selectedClient, question, cachedKey, stats, toast, selectedModel, dateFrom, dateTo, selectedActivities]);


  if (!allowed) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  const isLoading = loadingPhase !== "idle";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
          <Brain className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Inteligência</h1>
          <p className="text-sm text-muted-foreground">Pergunte sobre um cliente ou sobre o desempenho da oficina</p>
        </div>
      </div>

      {/* Scope Tabs */}
      <Tabs value={scope} onValueChange={(v) => { setScope(v as any); setStats(null); setAnalysis(null); setCachedKey(null); }}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="client" className="gap-2"><Brain className="h-4 w-4" /> Cliente</TabsTrigger>
          <TabsTrigger value="oficina" className="gap-2"><Wrench className="h-4 w-4" /> Oficina</TabsTrigger>
        </TabsList>
      </Tabs>

      {scope === "client" ? (
        /* Client Selector */
        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between h-11 text-left font-normal">
              {selectedClient ? (
                <span>
                  {selectedClient.nome}
                  {selectedClient.fazenda ? ` — ${selectedClient.fazenda}` : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Buscar por nome ou fazenda...</span>
              )}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cliente..." value={clientSearch} onValueChange={setClientSearch} />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="todos os clientes"
                    onSelect={() => {
                      setSelectedClient(ALL_CLIENTS_OPTION);
                      setOpenCombobox(false);
                    }}
                  >
                    <span className="font-medium">🌐 Todos os clientes</span>
                    <span className="text-muted-foreground text-xs ml-auto">Visão geral</span>
                  </CommandItem>
                  {clients.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.nome} ${c.fazenda || ""}`}
                      onSelect={() => {
                        setSelectedClient(c);
                        setOpenCombobox(false);
                      }}
                    >
                      <span className="font-medium">{c.nome}</span>
                      {c.fazenda && <span className="text-muted-foreground ml-2">— {c.fazenda}</span>}
                      {c.cidade && (
                        <span className="text-muted-foreground text-xs ml-auto">
                          {c.cidade}/{c.estado}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        /* Oficina Filters */
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground">De</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Até</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                />
              </div>
            </div>
            {activities.length > 0 && (
              <div>
                <label className="text-xs uppercase text-muted-foreground">Atividades (vazio = todas)</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-32 overflow-y-auto">
                  {activities.map((a) => {
                    const active = selectedActivities.includes(a.id);
                    return (
                      <Badge
                        key={a.id}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleActivity(a.id)}
                      >
                        {a.name}
                      </Badge>
                    );
                  })}
                </div>
                {selectedActivities.length > 0 && (
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => setSelectedActivities([])}>
                    Limpar seleção
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Question Input */}
      <div className="space-y-2">
        <Textarea
          placeholder={scope === "oficina" ? "Faça uma pergunta sobre a oficina..." : "Faça uma pergunta sobre o cliente..."}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="min-h-[80px] resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col">
                      <span>{m.label}</span>
                      <span className="text-[10px] text-muted-foreground">{m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || (scope === "client" && !selectedClient)}
            className="gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar
          </Button>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2">
        {(scope === "oficina"
          ? SUGGESTIONS_OFICINA
          : selectedClient?.id === "all"
          ? SUGGESTIONS_ALL
          : SUGGESTIONS_CLIENT
        ).map((s) => (
          <Badge
            key={s.label}
            variant="outline"
            className="cursor-pointer hover:bg-accent transition-colors px-3 py-1.5 text-sm"
            onClick={() => setQuestion(s.question)}
          >
            {s.icon} {s.label}

          </Badge>
        ))}
      </div>

      {/* Loading States */}
      {loadingPhase === "collecting" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-sm">📊 Coletando dados do cliente...</span>
          </CardContent>
        </Card>
      )}
      {loadingPhase === "analyzing" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            <span className="text-sm">🤖 Analisando com IA...</span>
          </CardContent>
        </Card>
      )}

      {/* Oficina Stats Panel */}
      {stats && !isLoading && scope === "oficina" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Oficina — {dateFrom} → {dateTo}
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <StatCard icon={Wrench} label="Total OS" value={stats.total_os || 0} color="text-blue-500" bg="bg-blue-500/10" />
            <StatCard icon={ClipboardCheck} label="Concluídas" value={stats.os_concluidas || 0} color="text-emerald-500" bg="bg-emerald-500/10" />
            <StatCard icon={Timer} label="Lead min" value={stats.lead_time_medio_min || 0} color="text-violet-500" bg="bg-violet-500/10" />
            <StatCard icon={Repeat2} label="Retrabalho" value={(stats.retrabalho_top || []).length} color="text-amber-500" bg="bg-amber-500/10" />
            <StatCard icon={Gauge} label="Motores crít." value={stats.motores_criticos || 0} color="text-red-500" bg="bg-red-500/10" />
            <StatCard icon={Package} label="Peças únicas" value={(stats.top_pecas || []).length} color="text-purple-500" bg="bg-purple-500/10" />
          </div>
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {detailsOpen ? "Recolher detalhes" : "Ver detalhes"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-2">
              {stats.por_atividade?.length > 0 && (
                <DetailSection title="⏱️ Por atividade" color="border-blue-500">
                  <ul className="text-sm list-disc list-inside">
                    {stats.por_atividade.slice(0, 10).map((a: any, i: number) => (
                      <li key={i}>
                        {a.name}: {a.count} OS
                        {a.avg_min !== null ? ` — média ${a.avg_min}m (min ${a.min_min}m, max ${a.max_min}m)` : ""}
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}
              {stats.top_pecas?.length > 0 && (
                <DetailSection title="🧩 Peças mais consumidas" color="border-purple-500">
                  <ul className="text-sm list-disc list-inside">
                    {stats.top_pecas.slice(0, 10).map((p: any, i: number) => (
                      <li key={i}>{p.label} ({p.total} un)</li>
                    ))}
                  </ul>
                </DetailSection>
              )}
              {stats.motores_topo?.length > 0 && (
                <DetailSection title="⚙️ Motores (top por horas de uso)" color="border-red-500">
                  <ul className="text-sm list-disc list-inside">
                    {stats.motores_topo.slice(0, 10).map((m: any, i: number) => (
                      <li key={i}>
                        {m.unique_code}: {m.motor_hours_used}h{" "}
                        <span className={m.level === "critico" ? "text-red-500" : m.level === "atencao" ? "text-amber-500" : "text-emerald-500"}>
                          ({m.level})
                        </span>
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}
              {stats.retrabalho_top?.length > 0 && (
                <DetailSection title="🔁 Possível retrabalho" color="border-amber-500">
                  <ul className="text-sm list-disc list-inside">
                    {stats.retrabalho_top.slice(0, 10).map((r: any, i: number) => (
                      <li key={i}>
                        {r.asset} — {r.part}: {r.repeats}x (OS {r.os_codes.join(", ")}; intervalos {r.intervals_days.join(", ")}d)
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Stats Panel */}
      {stats && !isLoading && scope === "client" && selectedClient?.id !== "all" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Dados encontrados para: {selectedClient?.nome}
          </h3>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <StatCard icon={ClipboardCheck} label="Preventivas" value={stats.total_preventivas} color="text-emerald-500" bg="bg-emerald-500/10" />
            <StatCard icon={AlertTriangle} label="Chamados" value={stats.total_chamados} color="text-orange-500" bg="bg-orange-500/10" />
            <StatCard icon={Eye} label="Visitas CRM" value={stats.total_visitas_crm} color="text-blue-500" bg="bg-blue-500/10" />
            <StatCard icon={FileText} label="Propostas" value={stats.total_propostas} color="text-amber-500" bg="bg-amber-500/10" />
            <StatCard icon={AudioLines} label="Áudios" value={stats.audios_gravados} color="text-violet-500" bg="bg-violet-500/10" />
            <StatCard icon={Package} label="Peças" value={stats.total_pecas_consumidas} color="text-purple-500" bg="bg-purple-500/10" />
          </div>

          {/* Collapsible Details */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {detailsOpen ? "Recolher detalhes" : "Ver detalhes"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-2">
              {/* Preventivas */}
              {stats.total_preventivas > 0 && (
                <DetailSection title="📅 Preventivas" color="border-emerald-500">
                  <p className="text-sm">Última: {stats.ultima_preventiva || "N/A"} | Concluída: {stats.ultima_concluida || "N/A"}</p>
                  <p className="text-sm">Status: {Object.entries(stats.preventivas_por_status).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
                  {stats.top_nao_conformidades.length > 0 && (
                    <>
                      <p className="text-sm font-medium mt-2">NCs mais frequentes:</p>
                      <ul className="text-sm list-disc list-inside">
                        {stats.top_nao_conformidades.slice(0, 5).map((nc, i) => (
                          <li key={i}>{nc.label} ({nc.count}x)</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {stats.top_pecas.length > 0 && (
                    <>
                      <p className="text-sm font-medium mt-2">Peças mais consumidas:</p>
                      <ul className="text-sm list-disc list-inside">
                        {stats.top_pecas.slice(0, 5).map((p, i) => (
                          <li key={i}>{p.label} ({p.total} un)</li>
                        ))}
                      </ul>
                    </>
                  )}
                </DetailSection>
              )}

              {/* Chamados */}
              {stats.total_chamados > 0 && (
                <DetailSection title="🔧 Chamados Técnicos" color="border-orange-500">
                  <p className="text-sm">Abertos: {stats.chamados_abertos.length} | Tempo médio: {stats.tempo_medio_resolucao !== null ? `${stats.tempo_medio_resolucao} dias` : "N/A"}</p>
                  {stats.chamados_abertos.length > 0 && (
                    <ul className="text-sm list-disc list-inside mt-1">
                      {stats.chamados_abertos.map((c, i) => (
                        <li key={i}>{c.code}: "{c.title}" ({c.priority})</li>
                      ))}
                    </ul>
                  )}
                </DetailSection>
              )}

              {/* CRM */}
              {stats.total_visitas_crm > 0 && (
                <DetailSection title="💼 CRM" color="border-blue-500">
                  <p className="text-sm">Visitas: {stats.total_visitas_crm} | Áudios: {stats.audios_gravados} ({stats.audios_transcritos} transcritos)</p>
                  {stats.produtos_crm.length > 0 && (
                    <ul className="text-sm list-disc list-inside mt-1">
                      {stats.produtos_crm.map((p, i) => (
                        <li key={i}>{p.product_code}: {p.stage}{p.value_estimated ? ` R$${p.value_estimated}` : ""}</li>
                      ))}
                    </ul>
                  )}
                  {stats.acoes_crm_recentes.length > 0 && (
                    <>
                      <p className="text-sm font-medium mt-2">Ações recentes:</p>
                      <ul className="text-sm list-disc list-inside">
                        {stats.acoes_crm_recentes.slice(0, 5).map((a, i) => (
                          <li key={i}>[{a.status}] {a.title}{a.due_at ? ` (prazo: ${a.due_at.substring(0, 10)})` : ""}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </DetailSection>
              )}

              {/* Pedidos */}
              {Object.keys(stats.pedidos_por_status).length > 0 && (
                <DetailSection title="📦 Pedidos" color="border-purple-500">
                  <p className="text-sm">Status: {Object.entries(stats.pedidos_por_status).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
                  <p className="text-sm">Pendentes: {stats.pedidos_pendentes.length}</p>
                </DetailSection>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* AI Response */}
      {analysis && (
        <div className="border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 rounded-r-lg p-4 sm:p-6">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 py-3 px-2">
        <div className={`rounded-md p-1.5 ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <span className="text-xl font-bold">{value}</span>
        <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
      </CardContent>
    </Card>
  );
}

function DetailSection({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border-l-3 ${color} pl-3 space-y-1`}>
      <p className="font-semibold text-sm">{title}</p>
      {children}
    </div>
  );
}
