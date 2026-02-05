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

// Define known modules in the codebase - this acts as a registry
// In a real scenario, this could be auto-detected via file system scanning
const knownModules: CodeModule[] = [
  // Main Pages/Modules
  { name: 'Início (Home)', type: 'page', path: 'src/pages/Home.tsx', category: 'modulo' },
  { name: 'Pedidos de Peças', type: 'page', path: 'src/pages/Pedidos.tsx', category: 'modulo' },
  { name: 'Estoque', type: 'page', path: 'src/pages/Estoque.tsx', category: 'modulo' },
  
  // Preventivas
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
  
  // Chamados (Corretivas)
  { name: 'Chamados - Index', type: 'page', path: 'src/pages/chamados/Index.tsx', category: 'modulo' },
  { name: 'Chamados - Novo', type: 'page', path: 'src/pages/chamados/NovoChamado.tsx', category: 'modulo' },
  { name: 'Chamados - Detalhe', type: 'page', path: 'src/pages/chamados/DetalheChamado.tsx', category: 'modulo' },
  { name: 'Chamados - Execução Visita', type: 'page', path: 'src/pages/chamados/ExecucaoVisitaCorretiva.tsx', category: 'modulo' },
  { name: 'Chamados - Relatório', type: 'page', path: 'src/pages/chamados/RelatorioCorretivo.tsx', category: 'modulo' },
  
  // CRM/Clientes
  { name: 'CRM - Lista Clientes', type: 'page', path: 'src/pages/crm/ClientesList.tsx', category: 'modulo' },
  { name: 'CRM - Detalhe Cliente', type: 'page', path: 'src/pages/crm/ClienteDetail.tsx', category: 'modulo' },
  
  // Estoque
  { name: 'Estoque - Consumo', type: 'page', path: 'src/pages/estoque/Consumo.tsx', category: 'modulo' },
  { name: 'Estoque - Histórico', type: 'page', path: 'src/pages/estoque/Historico.tsx', category: 'modulo' },
  { name: 'Estoque - Previsão', type: 'page', path: 'src/pages/estoque/Previsao.tsx', category: 'modulo' },
  
  // Oficina
  { name: 'Oficina - Ordens de Serviço', type: 'page', path: 'src/pages/oficina/OrdensServico.tsx', category: 'modulo' },
  { name: 'Oficina - Itens', type: 'page', path: 'src/pages/oficina/ItensOficina.tsx', category: 'modulo' },
  { name: 'Oficina - Garantias', type: 'page', path: 'src/pages/oficina/Garantias.tsx', category: 'modulo' },
  { name: 'Oficina - Atividades', type: 'page', path: 'src/pages/oficina/Atividades.tsx', category: 'modulo' },
  
  // Admin
  { name: 'Admin - Clientes', type: 'page', path: 'src/pages/admin/Clientes.tsx', category: 'modulo' },
  { name: 'Admin - Usuários', type: 'page', path: 'src/pages/admin/Usuarios.tsx', category: 'modulo' },
  { name: 'Admin - Envios', type: 'page', path: 'src/pages/admin/Envios.tsx', category: 'modulo' },
  { name: 'Admin - Configurações', type: 'page', path: 'src/pages/admin/Config.tsx', category: 'modulo' },
  { name: 'Admin - Permissões', type: 'page', path: 'src/pages/admin/Permissoes.tsx', category: 'modulo' },
  
  // Documentação
  { name: 'Docs - Index', type: 'page', path: 'src/pages/docs/Index.tsx', category: 'modulo' },
  { name: 'Docs - Chat IA', type: 'page', path: 'src/pages/docs/DocChat.tsx', category: 'modulo' },
  { name: 'Docs - Editor', type: 'page', path: 'src/pages/docs/DocEditor.tsx', category: 'modulo' },
  { name: 'Docs - Visualização', type: 'page', path: 'src/pages/docs/DocView.tsx', category: 'modulo' },
  { name: 'Docs - Público', type: 'page', path: 'src/pages/docs/PublicDocs.tsx', category: 'modulo' },
  
  // Core Hooks
  { name: 'Hook - Offline Sync', type: 'hook', path: 'src/hooks/useOfflineSync.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Data', type: 'hook', path: 'src/hooks/useOfflineData.ts', category: 'regra_transversal' },
  { name: 'Hook - Offline Checklist', type: 'hook', path: 'src/hooks/useOfflineChecklist.ts', category: 'regra_transversal' },
  { name: 'Hook - Menu Permissions', type: 'hook', path: 'src/hooks/useMenuPermissions.ts', category: 'regra_transversal' },
  { name: 'Hook - Geolocation', type: 'hook', path: 'src/hooks/useGeolocation.ts', category: 'regra_transversal' },
  
  // Contexts
  { name: 'Context - Auth', type: 'context', path: 'src/contexts/AuthContext.tsx', category: 'regra_transversal' },
  { name: 'Context - Offline', type: 'context', path: 'src/contexts/OfflineContext.tsx', category: 'regra_transversal' },
  
  // Key Components
  { name: 'Component - Checklist Execution', type: 'component', path: 'src/components/preventivas/ChecklistExecution.tsx', category: 'modulo' },
  { name: 'Component - Farm Map', type: 'component', path: 'src/components/preventivas/FarmMap.tsx', category: 'modulo' },
  { name: 'Component - App Sidebar', type: 'component', path: 'src/components/layout/AppSidebar.tsx', category: 'regra_transversal' },
  { name: 'Component - App Layout', type: 'component', path: 'src/components/layout/AppLayout.tsx', category: 'regra_transversal' },
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

    // Verify user is admin or coordinator
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const userId = claimsData.claims.sub

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
