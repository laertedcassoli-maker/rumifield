## Objetivo
Eliminar os cortes que ainda aparecem no PDF dos relatórios e estabilizar a composição para blocos longos, imagens e cards grandes, preservando o visual atual.

## O que vou ajustar
1. **Quebra real por blocos internos**
   - Reestruturar a geração em `share-report-pdf.ts` para evitar o fallback de recorte bruto sempre que possível.
   - Quando um `data-pdf-section` for grande demais, quebrar por grupos lógicos menores e manter o contexto visual entre páginas.
   - Impedir que o PDF comece uma nova página já com conteúdo cortado no topo, como aconteceu nas páginas 4 e 6 do arquivo enviado.

2. **Preparar os cards para modo PDF**
   - Ajustar `RelatorioCorretivo.tsx` e `RelatorioPreventivo.tsx` para que cards altos virem blocos mais seguros no modo PDF.
   - Separar melhor áreas críticas como:
     - card de informações da visita
     - checklist por bloco/item
     - peças utilizadas
     - galeria de fotos
     - observações
   - Converter layouts que hoje comprimem ou estouram no PDF para versões mais estáveis em captura, sem mexer na visualização normal da tela.

3. **Evitar cortes em conteúdo específico já identificado**
   - Corrigir o card inicial que corta a linha de “Chamado Vinculado”.
   - Corrigir a transição entre páginas no checklist, onde itens estão entrando cortados no topo da página seguinte.
   - Corrigir a galeria de mídia para não atravessar páginas no meio de uma linha de fotos.

4. **Refinar o CSS exclusivo de captura**
   - Fortalecer regras de PDF no `index.css` para alinhamento, wrapping, altura de linha e comportamento de grids/flex em captura.
   - Reduzir risco de estouro horizontal e garantir melhor distribuição vertical dos blocos.

5. **Validar com novo PDF de prova**
   - Gerar um novo PDF modelo após os ajustes.
   - Converter todas as páginas em imagem e revisar visualmente para confirmar:
     - sem cortes no topo/rodapé
     - sem cards truncados
     - sem labels sobrepostos
     - fotos inteiras e organizadas
     - textos longos quebrando corretamente

## Arquivos previstos
- `src/lib/share-report-pdf.ts`
- `src/pages/chamados/RelatorioCorretivo.tsx`
- `src/pages/preventivas/RelatorioPreventivo.tsx`
- `src/index.css`

## Detalhes técnicos
- O problema atual não é só de estilo: parte do conteúdo ainda cai no mecanismo de slicing do canvas, que corta visualmente o bloco quando não encontra divisões seguras suficientes.
- O PDF enviado mostrou três sintomas claros:
  - card de cabeçalho/visita com conteúdo truncado no fim da página 1
  - páginas começando com continuação visual cortada no topo
  - grade de mídia atravessando a troca de página
- A correção vai combinar **mais marcações de sub-blocos no JSX** com **paginação mais defensiva no gerador** e **CSS específico para captura**.

## Resultado esperado
O PDF passa a respeitar os limites da página, mantendo textos, cards e imagens íntegros mesmo com conteúdo extenso.