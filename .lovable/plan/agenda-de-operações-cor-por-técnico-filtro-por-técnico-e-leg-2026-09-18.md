# Agenda de Operações — cor por técnico, filtro por técnico e legenda

## Objetivo
No calendário (src/pages/AgendaOperacoes.tsx), a cor do evento passa a identificar o técnico/responsável (consistente entre sessões), o grupo (Novas Instalações vs Instalações Existentes) passa a ser indicado por outro sinal visual, e um novo filtro por técnico combina com o filtro de grupo existente. Uma legenda nome → cor fica visível na tela.

## Mudanças (somente src/pages/AgendaOperacoes.tsx)

### 1. Cor determinística por técnico
- Nova função `corPorTecnico(nome: string | null): string`:
  - Hash simples e estável do nome (ex.: soma de charCodes com multiplicador — estilo djb2), mapeado para índice de uma paleta fixa `PALETA_TECNICOS` com ~10 cores distintas e acessíveis (tons de azul, verde, âmbar, magenta, ciano, etc. — valores `hsl(...)` literais, pois são dados visuais por pessoa, não tokens de tema).
  - Mesmo nome → mesma cor, sempre; `null` (sem responsável) recebe uma cor neutra fixa (cinza).

### 2. Cor do evento = técnico; grupo por outro sinal visual
- Em `calendarEvents`, `backgroundColor`/`borderColor` passam a usar `corPorTecnico(e.tecnicoNome)` (removendo `GRUPO_COLORS`).
- Distinção de grupo via borda tracejada: eventos de `instalacoes_existentes` recebem `borderColor` igual ao fundo mas estilo aplicado em `eventDidMount` (`info.el.style.borderStyle = 'dashed'` quando grupo = 'instalacoes_existentes'; Novas Instalações permanece sólido). Passar `grupo` também em `extendedProps`.

### 3. Filtro por técnico (combina com o de grupo)
- Novo estado `filtroTecnico: string` (padrão `'todos'`).
- Lista de técnicos distintos derivada via `useMemo` a partir de `eventos` (nomes únicos, ordenados alfabeticamente, ignorando `null`).
- Novo `Select` (shadcn) ao lado dos botões de filtro de grupo, com "Todos os técnicos" + um item por nome.
- O `filter` de `calendarEvents` passa a combinar: `(filtro === 'all' || e.grupo === filtro) && (filtroTecnico === 'todos' || e.tecnicoNome === filtroTecnico)`.

### 4. Legenda nome → cor
- Substituir a legenda fixa atual (2 chips por grupo) por:
  - Chips dinâmicos: um por técnico presente nos eventos carregados (quadradinho com a cor + nome).
  - Dois chips de estilo de borda para o grupo: quadrado com borda sólida = Novas Instalações; borda tracejada = Instalações Existentes.
- A legenda de técnicos reflete os eventos carregados (não o filtro selecionado), para o usuário sempre ver o mapa completo de cores.

## O que NÃO muda
- Nenhuma alteração em src/hooks/useAgendaOperacoes.ts (fontes, campos de AgendaEvento, títulos).
- Rotas de destino ao clicar, filtro de grupo existente, visões do calendário, schema/RLS.

## Critérios de aceite
- Cada técnico/responsável tem cor consistente e distinta, com legenda visível.
- Filtro por técnico funciona combinado com o filtro de grupo.
- Grupo continua distinguível visualmente (borda sólida vs tracejada + legenda).

## Validação
- `bunx tsgo --noEmit` + build (log).
- Playwright em /agenda-operacoes: screenshot com cores por técnico, legenda, e filtro por técnico aplicado.
