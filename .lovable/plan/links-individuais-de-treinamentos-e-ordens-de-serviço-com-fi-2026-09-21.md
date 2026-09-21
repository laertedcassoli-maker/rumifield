# Links individuais de Treinamentos e Ordens de Serviço com filtro

## Contexto
Em Minhas Pendências, os itens individuais das seções "Treinamentos" e "Ordens de Serviço" linkam sem parâmetros (`/treinamento` e `/oficina/os`), enquanto o "Ver todas" de cada seção já leva com `?meu=1&status=pendente`. Confirmado no arquivo: linha 283 (`to="/treinamento"`) e linha 303 (`to="/oficina/os"`); os Sections pais (linhas 273 e 294) já usam os parâmetros corretos.

## Mudanças — src/pages/MinhasPendencias.tsx
1. Seção "Treinamentos": trocar o `to` da PendenciaRow individual de `/treinamento` para `/treinamento?meu=1&status=pendente`.
2. Seção "Ordens de Serviço": trocar o `to` da PendenciaRow individual de `/oficina/os` para `/oficina/os?meu=1&status=pendente`.

Nada mais muda: as demais seções seguem linkando para o item específico, os "Ver todas" ficam como estão, e nenhuma lógica de `useMinhasPendencias.ts` ou das telas de destino é alterada (elas já leem os parâmetros).

## Validação
- `bunx tsgo --noEmit` limpo.
- No preview, clicar num item individual de Ordens de Serviço → chega em `/oficina/os?meu=1&status=pendente` com "Meu" + aba "Abertas"; mesmo teste para Treinamentos.
