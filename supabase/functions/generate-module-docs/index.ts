import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ModuleToDocument {
  name: string;
  type: string;
  path: string;
  category: string;
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

    const { modules } = await req.json() as { modules: ModuleToDocument[] }

    if (!modules || modules.length === 0) {
      return new Response(JSON.stringify({ error: 'No modules provided' }), { 
        status: 400, 
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

    let generated = 0
    const errors: string[] = []

    for (const module of modules) {
      try {
        // Generate slug from module name
        const slug = module.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        // Determine type label
        const typeLabels: Record<string, string> = {
          page: 'Página',
          component: 'Componente',
          hook: 'Hook',
          context: 'Contexto',
        }
        const typeLabel = typeLabels[module.type] || 'Módulo'

        // Generate documentation content
        const content = `# ${module.name}

## Visão Geral

**Tipo:** ${typeLabel}
**Arquivo:** \`${module.path}\`

## Descrição

> ⚠️ **Documentação pendente** - Este documento foi gerado automaticamente e precisa ser preenchido.

[Descreva aqui o propósito e funcionalidade deste ${typeLabel.toLowerCase()}]

## Funcionalidades Principais

- [ ] Funcionalidade 1
- [ ] Funcionalidade 2
- [ ] Funcionalidade 3

## Dependências

[Liste as principais dependências e integrações]

## Regras de Negócio

[Documente as regras de negócio aplicáveis]

## Notas de Implementação

[Adicione notas técnicas relevantes]
`

        const summary = `${typeLabel} - ${module.name}. Documentação pendente de preenchimento.`

        // Insert documentation
        const { error: insertError } = await supabase
          .from('system_documentation')
          .insert({
            slug,
            title: module.name,
            category: module.category,
            content,
            summary,
                is_public: true,
            related_modules: [module.path],
            ai_metadata: {
              auto_generated: true,
              module_type: module.type,
              module_path: module.path,
              needs_review: true,
            },
            updated_by: userId,
          })

        if (insertError) {
          // If slug already exists, try with prefix
          if (insertError.code === '23505') {
            const prefixedSlug = `${module.category}-${slug}`
            const { error: retryError } = await supabase
              .from('system_documentation')
              .insert({
                slug: prefixedSlug,
                title: module.name,
                category: module.category,
                content,
                summary,
                is_public: true,
                related_modules: [module.path],
                ai_metadata: {
                  auto_generated: true,
                  module_type: module.type,
                  module_path: module.path,
                  needs_review: true,
                },
                updated_by: userId,
              })
            
            if (retryError) {
              errors.push(`${module.name}: ${retryError.message}`)
            } else {
              generated++
            }
          } else {
            errors.push(`${module.name}: ${insertError.message}`)
          }
        } else {
          generated++
        }
      } catch (e) {
        errors.push(`${module.name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
      }
    }

    console.log(`Generated ${generated} module docs, ${errors.length} errors`)

    return new Response(JSON.stringify({ 
      generated, 
      errors: errors.length > 0 ? errors : undefined 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('Error in generate-module-docs:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
