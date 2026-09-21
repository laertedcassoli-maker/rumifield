# Minhas Pendências: "Ver todas" + seção unificada + Treinamentos e OS

## src/hooks/useMinhasPendencias.ts

Duas novas queries após `aprovacoesInstalacao` (mesmo padrão das existentes; a coluna real da tabela é `cliente_id`, confirmado em Treinamento.tsx):

```ts
const treinamentos = useQuery({
  queryKey: ['training-visits', 'pendencias', uid],
  enabled: !!uid,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('training_visits')
      .select('id, cliente_id, status, planned_date')
      .or(`technician_user_id.eq.${uid},csm_user_id.eq.${uid}`)
      .eq('status', 'pendente')
      .order('planned_date', { ascending: true });
    if (error) throw error;
    const clientesMap = await fetchClientesMap([...new Set((data ?? []).map(t => t.cliente_id).filter(Boolean))]);
    return (data ?? []).map(t => ({
      id: t.id,
      clienteNome: clientesMap.get(t.cliente_id)?.nome ?? 'Cliente',
      fazenda: clientesMap.get(t.cliente_id)?.fazenda ?? null,
      plannedDate: t.planned_date,
      status: t.status,
    }));
  },
});

const ordensServico = useQuery({
  queryKey: ['work-orders', 'pendencias', uid],
  enabled: !!uid,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('work_orders')
      .select('id, code, status, created_at, activities(name)')
      .eq('assigned_to_user_id', uid!)
      .neq('status', 'concluido')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(o => ({
      id: o.id,
      code: o.code,
      atividade: (o as any).activities?.name ?? null,
      createdAt: o.created_at,
      status: o.status,
    }));
  },
});
```

- Somar os dois em `total` e incluir `treinamentos`/`ordensServico` no retorno e no `isLoading`.

## src/pages/MinhasPendencias.tsx

- Nova `SectionProps.to?: string`; quando presente, o cabeçalho mostra link "Ver todas" (small, muted, ArrowRight) ao lado do badge, via `<Link to={to}>`.
- Unificar "Preventivas" + "Visitas Técnicas" numa única seção "Visitas Técnicas" (ícone Contact): lista = preventivas.data + visitas.data (contagem combinada, isLoading = preventivas.isLoading || visitas.isLoading). Cada item mantém seu destino atual (rota preventiva → /preventivas/execucao/..., visita → /chamados/visita/...).
- Novas seções:
  - Treinamentos (GraduationCap) → itens com code = "Treinamento", date = plannedDate, destino /treinamento; seção com to="/treinamento?meu=1&status=pendente".
  - Ordens de Serviço (FileText) → itens com code = o.code, sublinha atividade no lugar de cliente (cliente = atividade ?? '—'), date = createdAt, status; seção com to="/oficina/os?meu=1&status=pendente".
- Links "Ver todas" por seção: Visitas Técnicas → /visita-tecnica?meu=1&status=pendente; Chamados → /chamados?meu=1&status=pendente; Coleta Reversa → /pedidos?tipo=coleta_reversa&meu=1&status=pendente; Envios → /pedidos?tipo=envio&meu=1&status=pendente; Instalações → /instalacoes?meu=1.
- Ícones: Chamados vira AlertTriangle (era Ticket); Envios Truck; Coleta Reversa RefreshCcw (já é); Visitas Técnicas Contact.
- "Aprovações de Instalação" fica sem link, como está.

## Intocado

- Queries existentes de preventivas/visitas/chamados/coletaReversa/envios/instalacoes/aprovacoesInstalacao.
- Todas as telas de destino (filtros ?meu=1&status=pendente já entregues).
- Listas compactas atuais (PendenciaRow etc.) — só ganham a seção unificada e o link novo.

## Critérios de aceite

- 7 seções + Aprovações (para quem tem permissão), cada uma (exceto Aprovações) com "Ver todas" para a tela certa pré-filtrada.
- Ícones batem com o submenu da sidebar; badge do menu (total) passa a contar também Treinamentos e OS.
