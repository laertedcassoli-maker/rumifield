import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CodeModule {
  name: string;
  type: 'page' | 'component' | 'hook' | 'context';
  path: string;
  category: string;
}

interface CodeChange {
  type: 'undocumented_module';
  module_name: string;
  module_type: string;
  module_path: string;
  details: string;
}

// Complete registry of all known modules in the codebase
const knownModules: CodeModule[] = [
  // ── Main Pages ──
  { name: 'Início (Home)', type: 'page', path: 'src/pages/Home.tsx', category: 'modulo' },
  { name: 'Dashboard', type: 'page', path: 'src/pages/Dashboard.tsx', category: 'modulo' },
  { name: 'Pedidos de Peças', type: 'page', path: 'src/pages/Pedidos.tsx', category: 'modulo' },
  { name: 'Estoque', type: 'page', path: 'src/pages/Estoque.tsx', category: 'modulo' },
  { name: 'Visitas', type: 'page', path: 'src/pages/Visitas.tsx', category: 'modulo' },
  { name: 'Autenticação', type: 'page', path: 'src/pages/Auth.tsx', category: 'modulo' },
  { name: 'Aceitar Convite', type: 'page', path: 'src/pages/AceitarConvite.tsx', category: 'modulo' },
  { name: 'NFC', type: 'page', path: 'src/pages/Nfc.tsx', category: 'modulo' },
  { name: 'Instalar PWA', type: 'page', path: 'src/pages/Instalar.tsx', category: 'modulo' },

  // ── Preventivas ──
  { name: 'Preventivas - Index', type: 'page', path: 'src/pages/preventivas/Index.tsx', category: 'modulo' },
  { name: 'Preventivas - Rotas', type: 'page', path: 'src/pages/preventivas/Rotas.tsx', category: 'modulo' },
  { name: 'Preventivas - Minhas Rotas', type: 'page', path: 'src/pages/preventivas/MinhasRotas.tsx', category: 'modulo' },
  { name: 'Preventivas - Detalhe Rota', type: 'page', path: 'src/pages/preventivas/DetalheRota.tsx', category: 'modulo' },
  { name: 'Preventivas - Execução Rota', type: 'page', path: 'src/pages/preventivas/ExecucaoRota.tsx', category: 'modulo' },
  { name: 'Preventivas - Atendimento', type: 'page', path: 'src/pages/preventivas/AtendimentoPreventivo.tsx', category: 'modulo' },
  { name: 'Preventivas - Calendário', type: 'page', path: 'src/pages/preventivas/Calendario.tsx', category: 'modulo' },
  { name: 'Preventivas - Checklists', type: 'page', path: 'src/pages/preventivas/Checklists.tsx', category: 'modulo' },
  { name: 'Preventivas - Editor Checklist', type: 'page', path: 'src/pages/preventivas/ChecklistEditor.tsx', category: 'modulo' },
  { name: 'Preventivas - Relatório', type: 'page', path: 'src/pages/preventivas/RelatorioPreventivo.tsx', category: 'modulo' },
  { name: 'Preventivas - Nova Rota', type: 'page', path: 'src/pages/preventivas/NovaRota.tsx', category: 'modulo' },

  // ── Chamados (Corretivas) ──
  { name: 'Chamados - Index', type: 'page', path: 'src/pages/chamados/Index.tsx', category: 'modulo' },
  { name: 'Chamados - Novo', type: 'page', path: 'src/pages/chamados/NovoChamado.tsx', category: 'modulo' },
  { name: 'Chamados - Detalhe', type: 'page', path: 'src/pages/chamados/DetalheChamado.tsx', category: 'modulo' },
  { name: 'Chamados - Execução Visita', type: 'page', path: 'src/pages/chamados/ExecucaoVisitaCorretiva.tsx', category: 'modulo' },
  { name: 'Chamados - Relatório', type: 'page', path: 'src/pages/chamados/RelatorioCorretivo.tsx', category: 'modulo' },

  // ── CRM ──
  { name: 'CRM - Dashboard', type: 'page', path: 'src/pages/crm/CrmDashboard.tsx', category: 'modulo' },
  { name: 'CRM - Pipeline', type: 'page', path: 'src/pages/crm/CrmPipeline.tsx', category: 'modulo' },
  { name: 'CRM - Carteira', type: 'page', path: 'src/pages/crm/CrmCarteira.tsx', category: 'modulo' },
  { name: 'CRM - Lista Clientes', type: 'page', path: 'src/pages/crm/ClientesList.tsx', category: 'modulo' },
  { name: 'CRM - Cliente 360', type: 'page', path: 'src/pages/crm/CrmCliente360.tsx', category: 'modulo' },
  { name: 'CRM - Ações', type: 'page', path: 'src/pages/crm/CrmAcoes.tsx', category: 'modulo' },
  { name: 'CRM - Visitas', type: 'page', path: 'src/pages/crm/CrmVisitas.tsx', category: 'modulo' },
  { name: 'CRM - Execução Visita', type: 'page', path: 'src/pages/crm/CrmVisitaExecucao.tsx', category: 'modulo' },
  { name: 'CRM - Inteligência', type: 'page', path: 'src/pages/crm/CrmInteligencia.tsx', category: 'modulo' },

  // ── Estoque ──
  { name: 'Estoque - Consumo', type: 'page', path: 'src/pages/estoque/Consumo.tsx', category: 'modulo' },
  { name: 'Estoque - Histórico', type: 'page', path: 'src/pages/estoque/Historico.tsx', category: 'modulo' },
  { name: 'Estoque - Previsão', type: 'page', path: 'src/pages/estoque/Previsao.tsx', category: 'modulo' },

  // ── Oficina ──
  { name: 'Oficina - Ordens de Serviço', type: 'page', path: 'src/pages/oficina/OrdensServico.tsx', category: 'modulo' },
  { name: 'Oficina - Itens', type: 'page', path: 'src/pages/oficina/ItensOficina.tsx', category: 'modulo' },
  { name: 'Oficina - Garantias', type: 'page', path: 'src/pages/oficina/Garantias.tsx', category: 'modulo' },
  { name: 'Oficina - Atividades', type: 'page', path: 'src/pages/oficina/Atividades.tsx', category: 'modulo' },

  // ── Admin ──
  { name: 'Admin - Clientes', type: 'page', path: 'src/pages/admin/Clientes.tsx', category: 'modulo' },
  { name: 'Admin - Usuários', type: 'page', path: 'src/pages/admin/Usuarios.tsx', category: 'modulo' },
  { name: 'Admin - Envios', type: 'page', path: 'src/pages/admin/Envios.tsx', category: 'modulo' },
  { name: 'Admin - Configurações', type: 'page', path: 'src/pages/admin/Config.tsx', category: 'modulo' },
  { name: 'Admin - Permissões', type: 'page', path: 'src/pages/admin/Permissoes.tsx', category: 'modulo' },
  { name: 'Admin - Tags Chamados', type: 'page', path: 'src/pages/admin/TicketTags.tsx', category: 'modulo' },
  { name: 'Admin - CRM Config', type: 'page', path: 'src/pages/admin/CrmConfig.tsx', category: 'modulo' },
  { name: 'Admin - CRM Métricas', type: 'page', path: 'src/pages/admin/CrmMetricas.tsx', category: 'modulo' },
  { name: 'Admin - Google Sheets Config', type: 'page', path: 'src/pages/admin/GoogleSheetsConfig.tsx', category: 'modulo' },

  // ── Documentação ──
  { name: 'Docs - Index', type: 'page', path: 'src/pages/docs/Index.tsx', category: 'modulo' },
  { name: 'Docs - Chat IA', type: 'page', path: 'src/pages/docs/DocChat.tsx', category: 'modulo' },
  { name: 'Docs - Editor', type: 'page', path: 'src/pages/docs/DocEditor.tsx', category: 'modulo' },
  { name: 'Docs - Visualização', type: 'page', path: 'src/pages/docs/DocView.tsx', category: 'modulo' },
  { name: 'Docs - Público', type: 'page', path: 'src/pages/docs/PublicDocs.tsx', category: 'modulo' },

  // ── Core Hooks ──
  { name: 'Hook - Offline Sync', type: 'hook', path: 'src/hooks/useOfflineSync.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Data', type: 'hook', path: 'src/hooks/useOfflineData.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Checklist', type: 'hook', path: 'src/hooks/useOfflineChecklist.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Pedidos', type: 'hook', path: 'src/hooks/useOfflinePedidos.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Preventivas', type: 'hook', path: 'src/hooks/useOfflinePreventivas.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Rotas', type: 'hook', path: 'src/hooks/useOfflineRotas.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Query', type: 'hook', path: 'src/hooks/useOfflineQuery.ts', category: 'regra_transversal' },
  { name: 'Hook - Menu Permissions', type: 'hook', path: 'src/hooks/useMenuPermissions.ts', category: 'regra_transversal' },
  { name: 'Hook - Geolocation', type: 'hook', path: 'src/hooks/useGeolocation.ts', category: 'regra_transversal' },
  { name: 'Hook - CRM Data', type: 'hook', path: 'src/hooks/useCrmData.ts', category: 'regra_transversal' },
  { name: 'Hook - CRM Ações Data', type: 'hook', path: 'src/hooks/useCrmAcoesData.ts', category: 'regra_transversal' },
  { name: 'Hook - Debounce', type: 'hook', path: 'src/hooks/useDebounce.ts', category: 'regra_transversal' },

  // ── Contexts ──
  { name: 'Context - Auth', type: 'context', path: 'src/contexts/AuthContext.tsx', category: 'regra_transversal' },
  { name: 'Context - Offline', type: 'context', path: 'src/contexts/OfflineContext.tsx', category: 'regra_transversal' },

  // ── Key Components - Preventivas ──
  { name: 'Component - Checklist Execution', type: 'component', path: 'src/components/preventivas/ChecklistExecution.tsx', category: 'modulo' },
  { name: 'Component - Farm Map', type: 'component', path: 'src/components/preventivas/FarmMap.tsx', category: 'modulo' },
  { name: 'Component - Farm Selection Panel', type: 'component', path: 'src/components/preventivas/FarmSelectionPanel.tsx', category: 'modulo' },
  { name: 'Component - Checkin Dialog', type: 'component', path: 'src/components/preventivas/CheckinDialog.tsx', category: 'modulo' },
  { name: 'Component - Visit Media Upload', type: 'component', path: 'src/components/preventivas/VisitMediaUpload.tsx', category: 'modulo' },
  { name: 'Component - Consumed Parts Block', type: 'component', path: 'src/components/preventivas/ConsumedPartsBlock.tsx', category: 'modulo' },
  { name: 'Component - Nonconformity Parts Manager', type: 'component', path: 'src/components/preventivas/NonconformityPartsManager.tsx', category: 'modulo' },
  { name: 'Component - Checklist Block Nav', type: 'component', path: 'src/components/preventivas/ChecklistBlockNav.tsx', category: 'modulo' },
  { name: 'Component - Checklist Floating Progress', type: 'component', path: 'src/components/preventivas/ChecklistFloatingProgress.tsx', category: 'modulo' },
  { name: 'Component - Cancelar Visita Dialog', type: 'component', path: 'src/components/preventivas/CancelarVisitaDialog.tsx', category: 'modulo' },
  { name: 'Component - Observations Block', type: 'component', path: 'src/components/preventivas/ObservationsBlock.tsx', category: 'modulo' },

  // ── Key Components - Chamados ──
  { name: 'Component - Ticket Status Stepper', type: 'component', path: 'src/components/chamados/TicketStatusStepper.tsx', category: 'modulo' },
  { name: 'Component - Ticket Substatus Card', type: 'component', path: 'src/components/chamados/TicketSubstatusCard.tsx', category: 'modulo' },
  { name: 'Component - Ticket Parts Request Panel', type: 'component', path: 'src/components/chamados/TicketPartsRequestPanel.tsx', category: 'modulo' },
  { name: 'Component - Finalizar Chamado Dialog', type: 'component', path: 'src/components/chamados/FinalizarChamadoDialog.tsx', category: 'modulo' },
  { name: 'Component - Nova Visita Direta Dialog', type: 'component', path: 'src/components/chamados/NovaVisitaDiretaDialog.tsx', category: 'modulo' },

  // ── Key Components - CRM ──
  { name: 'Component - CRM Atualizar Negociação', type: 'component', path: 'src/components/crm/AtualizarNegociacaoModal.tsx', category: 'modulo' },
  { name: 'Component - CRM Criar Ação', type: 'component', path: 'src/components/crm/CriarAcaoModal.tsx', category: 'modulo' },
  { name: 'Component - CRM Criar Proposta', type: 'component', path: 'src/components/crm/CriarPropostaModal.tsx', category: 'modulo' },
  { name: 'Component - CRM Editar Ação', type: 'component', path: 'src/components/crm/EditarAcaoSheet.tsx', category: 'modulo' },
  { name: 'Component - CRM Finalizar Visita', type: 'component', path: 'src/components/crm/FinalizarVisitaModal.tsx', category: 'modulo' },
  { name: 'Component - CRM Qualificar Produto', type: 'component', path: 'src/components/crm/QualificarProdutoModal.tsx', category: 'modulo' },
  { name: 'Component - CRM Análise IA Cliente', type: 'component', path: 'src/components/crm/ClienteAnaliseIA.tsx', category: 'modulo' },
  { name: 'Component - CRM Histórico Cliente', type: 'component', path: 'src/components/crm/ClienteHistoricoTab.tsx', category: 'modulo' },
  { name: 'Component - CRM Timeline', type: 'component', path: 'src/components/crm/OpportunityTimeline.tsx', category: 'modulo' },
  { name: 'Component - CRM Audio Recorder', type: 'component', path: 'src/components/crm/AudioRecorderButton.tsx', category: 'modulo' },
  { name: 'Component - CRM Visit Audio List', type: 'component', path: 'src/components/crm/VisitAudioList.tsx', category: 'modulo' },
  { name: 'Component - CRM Cancelar Visita', type: 'component', path: 'src/components/crm/CancelarVisitaCrmDialog.tsx', category: 'modulo' },

  // ── Key Components - Pedidos ──
  { name: 'Component - Pedido Kanban', type: 'component', path: 'src/components/pedidos/PedidoKanban.tsx', category: 'modulo' },
  { name: 'Component - Processar Pedido Dialog', type: 'component', path: 'src/components/pedidos/ProcessarPedidoDialog.tsx', category: 'modulo' },
  { name: 'Component - Concluir Pedido Dialog', type: 'component', path: 'src/components/pedidos/ConcluirPedidoDialog.tsx', category: 'modulo' },
  { name: 'Component - Asset Search Field', type: 'component', path: 'src/components/pedidos/AssetSearchField.tsx', category: 'modulo' },

  // ── Key Components - Oficina ──
  { name: 'Component - OS Kanban', type: 'component', path: 'src/components/oficina/OSKanban.tsx', category: 'modulo' },
  { name: 'Component - Detalhe OS Dialog', type: 'component', path: 'src/components/oficina/DetalheOSDialog.tsx', category: 'modulo' },
  { name: 'Component - Nova OS Dialog', type: 'component', path: 'src/components/oficina/NovaOSDialog.tsx', category: 'modulo' },
  { name: 'Component - Motor Section', type: 'component', path: 'src/components/oficina/MotorSection.tsx', category: 'modulo' },

  // ── Key Components - Estoque ──
  { name: 'Component - Consumo Tab', type: 'component', path: 'src/components/estoque/ConsumoTab.tsx', category: 'modulo' },
  { name: 'Component - Nova Aferição Dialog', type: 'component', path: 'src/components/estoque/NovaAfericaoDialog.tsx', category: 'modulo' },
  { name: 'Component - Editar Aferição Dialog', type: 'component', path: 'src/components/estoque/EditarAfericaoDialog.tsx', category: 'modulo' },

  // ── Key Components - Admin ──
  { name: 'Component - CRM Checklist Rules', type: 'component', path: 'src/components/admin/CrmChecklistRulesSection.tsx', category: 'modulo' },
  { name: 'Component - CRM Loss Reasons', type: 'component', path: 'src/components/admin/CrmLossReasonsSection.tsx', category: 'modulo' },
  { name: 'Component - CRM Metric Definitions', type: 'component', path: 'src/components/admin/CrmMetricDefsSection.tsx', category: 'modulo' },

  // ── Layout Components ──
  { name: 'Component - App Sidebar', type: 'component', path: 'src/components/layout/AppSidebar.tsx', category: 'regra_transversal' },
  { name: 'Component - App Layout', type: 'component', path: 'src/components/layout/AppLayout.tsx', category: 'regra_transversal' },

  // ── Shared Components ──
  { name: 'Component - Error Boundary', type: 'component', path: 'src/components/ErrorBoundary.tsx', category: 'regra_transversal' },
  { name: 'Component - Offline Banner', type: 'component', path: 'src/components/OfflineBanner.tsx', category: 'regra_transversal' },
  { name: 'Component - Offline Indicator', type: 'component', path: 'src/components/OfflineIndicator.tsx', category: 'regra_transversal' },

  // ── Offline Libraries ──
  { name: 'Lib - Offline DB (Dexie)', type: 'hook', path: 'src/lib/offline-db.ts', category: 'regra_transversal' },
  { name: 'Lib - Offline Checklist DB', type: 'hook', path: 'src/lib/offline-checklist-db.ts', category: 'regra_transversal' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user via getUser
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const userId = user.id

    // Check if user is admin or coordinator
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (!userRole || !['admin', 'coordenador_servicos'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get existing module documentation
    const { data: existingDocs } = await supabase
      .from('system_documentation')
      .select('slug, title, category')
      .in('category', ['modulo', 'regra_transversal'])

    // Create a set of documented slugs for quick lookup
    const documentedSlugs = new Set(
      (existingDocs || []).map(doc => doc.slug.toLowerCase())
    )

    // Also create a set of documented titles for fuzzy matching
    const documentedTitles = new Set(
      (existingDocs || []).map(doc => doc.title.toLowerCase())
    )

    // Find undocumented modules
    const changes: CodeChange[] = []
    
    for (const module of knownModules) {
      // Generate expected slug
      const expectedSlug = module.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Check if documented by slug or title
      const isDocumented = 
        documentedSlugs.has(expectedSlug) ||
        documentedSlugs.has(`modulo-${expectedSlug}`) ||
        documentedSlugs.has(`${module.category}-${expectedSlug}`) ||
        documentedTitles.has(module.name.toLowerCase())

      if (!isDocumented) {
        changes.push({
          type: 'undocumented_module',
          module_name: module.name,
          module_type: module.type,
          module_path: module.path,
          details: `Tipo: ${module.type} | Categoria sugerida: ${module.category}`
        })
      }
    }

    // Summary stats
    const summary = {
      total_modules: knownModules.length,
      documented_modules: knownModules.length - changes.length,
      undocumented_count: changes.length,
      changes,
      module_types: {
        pages: knownModules.filter(m => m.type === 'page').length,
        components: knownModules.filter(m => m.type === 'component').length,
        hooks: knownModules.filter(m => m.type === 'hook').length,
        contexts: knownModules.filter(m => m.type === 'context').length,
      }
    }

    console.log('Code change detection completed:', summary)

    return new Response(JSON.stringify(summary), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in detect-code-changes:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
