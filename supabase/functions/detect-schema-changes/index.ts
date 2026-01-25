import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TableInfo {
  table_name: string;
  column_count: number;
  has_rls: boolean;
  policy_count: number;
}

interface SchemaChange {
  type: 'new_table' | 'missing_doc' | 'undocumented_table';
  table_name: string;
  details: string;
}

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

    // Get all tables from public schema
    const { data: tables, error: tablesError } = await supabase.rpc('get_schema_tables')
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError)
      // Fallback: use a simpler query via information_schema
      const { data: fallbackTables } = await supabase
        .from('information_schema.tables' as any)
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')

      // If RPC doesn't exist, we'll provide a simplified response
      return new Response(JSON.stringify({ 
        error: 'Schema introspection not available. Please create the get_schema_tables function.',
        suggestion: 'Run the migration to add schema introspection functions.'
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get existing documentation for tables
    const { data: existingDocs } = await supabase
      .from('system_documentation')
      .select('slug, title, updated_at')
      .eq('category', 'tabela')

    const documentedTables = new Set(
      (existingDocs || [])
        .map(doc => {
          // Extract table name from slug like "tabela-preventive-routes"
          const match = doc.slug.match(/^tabela-(.+)$/)
          return match ? match[1].replace(/-/g, '_') : null
        })
        .filter(Boolean)
    )

    // Compare and find changes
    const changes: SchemaChange[] = []
    const allTables = (tables as TableInfo[]) || []

    // Tables that exist but don't have documentation
    for (const table of allTables) {
      if (!documentedTables.has(table.table_name)) {
        changes.push({
          type: 'undocumented_table',
          table_name: table.table_name,
          details: `Tabela "${table.table_name}" não possui documentação. ${table.column_count} colunas, RLS: ${table.has_rls ? 'Sim' : 'Não'}, Políticas: ${table.policy_count}`
        })
      }
    }

    // Summary stats
    const summary = {
      total_tables: allTables.length,
      documented_tables: documentedTables.size,
      undocumented_count: changes.filter(c => c.type === 'undocumented_table').length,
      changes
    }

    console.log('Schema change detection completed:', summary)

    return new Response(JSON.stringify(summary), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in detect-schema-changes:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
