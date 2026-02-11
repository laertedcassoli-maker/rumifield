

## Correcao do layout mobile na pagina de Visita CRM

### Problema

Na tela mobile (390px), o conteudo da pagina de visita CRM esta sendo cortado na lateral direita. Os sintomas:
- Badge de status ("Concluida") nao aparece no header
- Informacoes de check-out cortadas na lateral
- Texto de acoes ultrapassando o limite do card

### Causa Raiz

O container principal (`div.space-y-6`) nao tem `min-w-0` nem `overflow-hidden`, o que permite que elementos internos com conteudo longo empurrem o layout para fora do viewport, mesmo com o wrapper pai tendo `overflow-x-hidden`.

### Solucao

**Arquivo: `src/pages/crm/CrmVisitaExecucao.tsx`**

1. **Container principal** (linha 225): Adicionar `min-w-0 overflow-hidden` ao div raiz para garantir que nenhum filho extrapole a largura disponivel

2. **Header com nome do cliente** (linha 227): Adicionar `min-w-0` ao flex container e ao div do nome para que o `truncate` funcione corretamente dentro do flex

3. **Badge de status no header** (linha 235): Adicionar `shrink-0` ao Badge para que ele nunca seja comprimido ou empurrado para fora

4. **Card de informacoes da visita** (linha 247): O `flex flex-wrap gap-4` ja esta correto, mas o `gap-4` pode ser reduzido para `gap-x-3 gap-y-1` para melhor aproveitamento em mobile

5. **Card de acoes** (linhas 452-467): Adicionar `overflow-hidden` ao Card e garantir que o container interno respeite os limites

### Detalhes Tecnicos

Mudancas exclusivamente em classes Tailwind CSS, sem alteracao de logica:

```text
Linha 225: "space-y-6 animate-fade-in pb-24"
        -> "space-y-6 animate-fade-in pb-24 min-w-0 overflow-hidden"

Linha 227: "flex items-center gap-3"
        -> "flex items-center gap-3 min-w-0"

Linha 231: "flex-1"
        -> "flex-1 min-w-0"

Linha 235: Badge sem shrink-0
        -> Adicionar "shrink-0" ao className do Badge

Linha 247: "flex flex-wrap gap-4"
        -> "flex flex-wrap gap-x-3 gap-y-1"
```

Apenas o arquivo `src/pages/crm/CrmVisitaExecucao.tsx` sera modificado.

