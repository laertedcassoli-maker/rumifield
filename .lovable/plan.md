# Plano para corrigir o PDF incompleto do relatório corretivo

## Objetivo
Garantir que o PDF do relatório corretivo saia completo, com checklist, peças, observações e fotografias, sem gerar arquivo parcial de 1 página.

## Diagnóstico confirmado
- O PDF enviado tem só **1 página** e mostra apenas o topo do relatório + observações.
- No banco, esse relatório está vinculado a uma preventiva com:
  - **7 mídias**
  - **4 peças**
  - **1 checklist concluído**
- Ou seja: **as informações existem**, mas estão sendo perdidas antes ou durante a geração do PDF.

## O que vou implementar
1. **Blindar o carregamento do relatório corretivo**
   - Reestruturar a montagem dos dados em `RelatorioCorretivo.tsx` para carregar preventiva vinculada, checklist, peças e mídias com verificações explícitas.
   - Remover quedas silenciosas para array vazio quando houver vínculo e algum trecho falhar.
   - Carregar blocos relacionados em paralelo para reduzir variações de timing.

2. **Só liberar o PDF quando o conteúdo estiver realmente pronto**
   - Ajustar a lógica de `data-report-ready` para só sinalizar pronto quando:
     - os dados principais estiverem resolvidos
     - a lista de mídias estiver resolvida
     - as URLs assinadas das fotos estiverem carregadas (ou com fallback explícito por item)
     - as seções esperadas estiverem montadas no DOM
   - Se o relatório estiver incompleto no momento da captura, o gerador vai abortar com erro claro em vez de baixar PDF faltando conteúdo.

3. **Fortalecer a captura no `share-report-pdf.ts`**
   - Validar seções obrigatórias antes de montar o PDF.
   - Evitar que uma falha de captura em uma seção faça aquela parte “sumir” sem aviso.
   - Tratar a galeria de mídia como blocos estáveis para não perder fotos durante o raster.
   - Manter fallback visual por item quando uma mídia específica não puder ser renderizada, sem descartar a seção inteira.

4. **Garantir QA do arquivo final**
   - Gerar um novo PDF modelo.
   - Converter todas as páginas em imagem.
   - Conferir visualmente página por página se checklist, peças e fotografias aparecem por completo e sem cortes.

## Arquivos previstos
- `src/pages/chamados/RelatorioCorretivo.tsx`
- `src/lib/share-report-pdf.ts`
- script temporário de geração/QA do PDF modelo

## Detalhes técnicos
- Vou trocar a montagem sequencial mais frágil por uma resolução mais determinística dos dados relacionados.
- Vou diferenciar “sem dados” de “falha ao carregar dados”, para o PDF nunca parecer válido quando estiver incompleto.
- A captura vai passar a validar presença real das seções esperadas no DOM antes de renderizar.
- As mídias continuarão com `useCORS`, mas com estado de prontidão mais rígido para impedir geração antecipada.

## Resultado esperado
Ao compartilhar/baixar o relatório corretivo interno, o PDF deve sair com todas as informações do atendimento, incluindo as **fotografias**, e com paginação completa.