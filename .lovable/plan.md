

## Criar endpoint unificado `docs-ai-full`

### Objetivo
Novo edge function que retorna TODA a documentacao publica em um unico Markdown, pronto para colar em uma conversa com IA externa (ChatGPT, Claude, etc).

### Como funciona
O endpoint busca todos os documentos publicos da tabela `system_documentation`, agrupa por categoria e gera um Markdown completo com:
- Cabecalho com nome do sistema, data de geracao e totais
- Indice (table of contents) com links internos
- Secoes por categoria: Visao Geral, Modulos, Tabelas, Regras, Permissoes
- Conteudo completo de cada documento (titulo, resumo, conteudo, metadados relevantes)
- Separadores claros entre documentos

### Endpoint publico resultante
```
GET https://gperaijwlecreqxoygjy.supabase.co/functions/v1/docs-ai-full
```
Retorna `text/markdown` diretamente -- basta abrir no navegador e copiar.

### Arquivos

**Novo:** `supabase/functions/docs-ai-full/index.ts`
- Busca todos os docs publicos com `select('slug, title, category, summary, content, ai_metadata, related_modules, updated_at')`
- Agrupa por categoria usando a mesma logica do `docs-ai-index`
- Gera Markdown unico com indice e conteudo completo
- Sem autenticacao (publico, como os demais endpoints AI)

**Editado:** `supabase/config.toml`
- Adicionar entrada `[functions.docs-ai-full]` com `verify_jwt = false`

### Estrutura do Markdown gerado

```markdown
# Documentacao Completa do Sistema - RumiField
> Gerado em: 2026-02-08T...
> Total: X documentos

## Indice
- Visao Geral
  - Doc 1
  - Doc 2
- Modulos
  - ...

---

## Visao Geral

### Doc Title
> Summary

Content...

---

## Modulos
...
```

### Detalhes tecnicos
- Reutiliza o padrao dos demais endpoints (cors headers, createClient com SERVICE_ROLE_KEY)
- Ordena categorias na sequencia logica: visao_geral > modulo > tabela > regra_transversal > permissao
- Inclui metadados relevantes (tabelas relacionadas, status possiveis, regras de negocio) inline no Markdown de cada doc
- Content-Type: `text/markdown; charset=utf-8` para facilitar visualizacao direta no navegador
