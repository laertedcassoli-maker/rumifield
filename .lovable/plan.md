

## Atualizar pagina "API Docs (IA)" com botao de atualizacao

### Situacao atual
O documento `api-docs-ai-layer` foi atualizado pela ultima vez em **25/01/2026** (cerca de 2 semanas atras). Ele e um documento estatico na tabela `system_documentation` que descreve os 3 endpoints da camada IA (`docs-ai-index`, `docs-ai-item`, `docs-ai-schema`). Nao existe mecanismo para atualizar automaticamente seu conteudo.

Os endpoints em si estao funcionando, mas o conteudo do documento pode estar desatualizado se houve mudancas nos edge functions ou na estrutura de dados retornada.

### Plano

**1. Criar edge function `refresh-ai-docs` que:**
- Chama os 3 endpoints existentes (`docs-ai-index`, `docs-ai-schema`, `docs-ai-item`) para coletar dados reais
- Gera o conteudo Markdown atualizado automaticamente com base na resposta real dos endpoints (quantidade de documentos, tabelas, campos retornados, exemplos reais)
- Atualiza o registro `api-docs-ai-layer` na tabela `system_documentation` com o novo conteudo e `updated_at`

**2. Adicionar botao "Atualizar" na pagina `DocView.tsx`:**
- Visivel apenas para o slug `api-docs-ai-layer` (ou docs com flag `auto_generated` no `ai_metadata`)
- Botao com icone `RefreshCw` ao lado do botao "Editar"
- Ao clicar, chama a edge function `refresh-ai-docs`
- Exibe loading e toast de sucesso/erro
- Recarrega o conteudo apos atualizacao

### Detalhes tecnicos

**Novo arquivo:** `supabase/functions/refresh-ai-docs/index.ts`
- Requer autenticacao (admin/coordenador)
- Faz fetch interno aos endpoints `docs-ai-index` e `docs-ai-schema` usando `SUPABASE_URL`
- Monta o Markdown com dados reais: total de documentos, total de tabelas, exemplos de resposta
- Faz `UPDATE` no registro com slug `api-docs-ai-layer`

**Arquivo editado:** `src/pages/docs/DocView.tsx`
- Adicionar botao "Atualizar" condicional (quando `doc.ai_metadata?.auto_refreshable === true` ou slug === `api-docs-ai-layer`)
- Estado de loading para o botao
- Chamar `supabase.functions.invoke('refresh-ai-docs')` no clique
- Invalidar query apos sucesso

**Arquivo editado:** `supabase/config.toml`
- Adicionar entrada para `refresh-ai-docs` com `verify_jwt = false`

