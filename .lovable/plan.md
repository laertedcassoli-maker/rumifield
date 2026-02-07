

## Ajuste do Prompt da Analise IA do Cliente

**Problema**: O prompt atual pede um relatorio extenso com 7 secoes fixas, incluindo secoes que podem nao ter dados, gerando texto generico e pouco util.

**Solucao**: Reescrever o `systemPrompt` na edge function para instruir a IA a ser concisa, focada apenas nos dados realmente presentes, e objetiva.

### Mudancas

**Arquivo**: `supabase/functions/crm-client-analysis/index.ts`

Substituir o `systemPrompt` atual (linhas ~189-220) por um prompt reformulado com as seguintes diretrizes:

1. **Formato compacto**: Em vez de 7 secoes fixas, usar apenas 3 blocos:
   - **Situacao Atual** - Resumo direto do estado do cliente em 2-3 frases (produtos ativos, estagio no funil, saude)
   - **Pontos de Atencao** - Lista curta apenas com alertas reais extraidos dos dados (acoes atrasadas, metricas ruins, chamados abertos, tempo sem visita)
   - **Proximos Passos** - 2-3 acoes concretas e prioritarias baseadas nos dados

2. **Regras do prompt**:
   - NAO inventar ou supor informacoes que nao estejam nos dados
   - NAO incluir secoes sem dados relevantes
   - NAO usar frases genericas como "recomenda-se acompanhar de perto"
   - Citar datas, valores e status especificos dos dados
   - Maximo de 400 palavras no total
   - Ir direto ao ponto, sem introducoes ou conclusoes formais

### Detalhe tecnico

O unico arquivo alterado sera `supabase/functions/crm-client-analysis/index.ts`, substituindo o bloco `systemPrompt` por um prompt mais enxuto e direcionado. Nenhuma outra mudanca necessaria.

