

## Melhorar cards de resumo do Pipeline no mobile

### Problema
Os 5 cards de contagem por estagio estao em `grid-cols-5` fixo, o que no mobile comprime demais cada card, cortando os labels ("Qualifica...", "Negociai...", "Perdido...").

### Solucao
Trocar o grid fixo por um layout com scroll horizontal no mobile, mantendo os 5 cards visiveis lado a lado sem cortar texto.

**Arquivo: `src/pages/crm/CrmPipeline.tsx`**

1. Substituir `grid grid-cols-5 gap-2` por um container com scroll horizontal: `flex gap-2 overflow-x-auto pb-1`
2. Cada card recebe `min-w-[72px] flex-shrink-0` para garantir largura minima legivel sem encolher
3. Em telas maiores, os cards se expandem naturalmente com `flex-1`
4. Adicionar `scrollbar-hide` ou estilo para esconder a barra de scroll no mobile

### Resultado
- Mobile: cards com largura minima legivel, scroll horizontal suave se necessario
- Desktop: layout distribuido uniformemente como antes

