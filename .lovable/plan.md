# Submenu "Novas Instalações" com filtro por etapa

## Contexto atual
- `src/components/layout/AppSidebar.tsx`: "Instalações" é item único e solto no Menu Principal (`mainMenuItems`, permKey `instalacoes`, url `/instalacoes`).
- `src/pages/instalacoes/Index.tsx`: listagem única que renderiza as 3 etapas (`STAGE_ORDER`: pre_venda, pre_instalacao, instalacao) como linhas dentro de cada card de instalação. `tecnico_campo` já vê apenas suas etapas; `canManage` já controla gestão.

## Mudanças

### 1. AppSidebar.tsx — submenu "Novas Instalações"
- Remover o item "Instalações" de `mainMenuItems`.
- Criar `instalacoesItems` (mesmo padrão de `pedidosItems`):
  - "Pré Venda" → `/instalacoes?etapa=pre_venda`
  - "Pré Instalação" → `/instalacoes?etapa=pre_instalacao`
  - "Instalação" → `/instalacoes?etapa=instalacao`
  - Ícones distintos (ex.: FileText, Settings2, HardHat) — sem permKeys novos; o grupo usa `canAccess('instalacoes')`.
- Renderizar no Menu Principal um `Collapsible` + `SidebarMenuSub` idêntico ao bloco "Solicitação de Peças":
  - Gate: `canAccess('instalacoes') && instalacoesItems.length > 0`.
  - `defaultOpen` quando a rota ativa; trigger com ícone `HardHat`, label "Novas Instalações", chevron.
  - Item ativo: `location.pathname === '/instalacoes' && location.search === '?etapa=...'` (mesma comparação `pathname + search` usada nos pedidos). Sem `?etapa`, nenhum filho fica ativo, mas o grupo destaca como ativo em `/instalacoes`.

### 2. Index.tsx — leitura do parâmetro `?etapa`
- Importar `useSearchParams` de react-router-dom e ler `etapa`; validar contra `STAGE_ORDER`/`StageType` (valor inválido = sem filtro).
- `etapaFiltro: StageType | null`.
- A query de instalações permanece exatamente como está (sem duplicar busca). O filtro é aplicado sobre `installations` em memória (memo):
  - Quando `etapaFiltro` está presente: mostrar apenas instalações que POSSUEM uma etapa do tipo selecionado (respeitando o recorte já feito para `tecnico_campo`), e dentro do card renderizar somente a linha dessa etapa. O `stage` continua vindo de `inst.stages.find(...)`.
  - Sem `etapaFiltro`: comportamento atual (todas as 3 etapas em todos os cards).
- Estado vazio quando filtrado: mensagem específica, ex. "Nenhuma instalação com etapa [Pré Venda] encontrada." (mantendo a mensagem atual para técnico sem etapas quando aplicável).
- Header: quando filtrado, exibir a etapa ativa como `Badge` ao lado do título "Instalações" (destaque simples, sem mudar estrutura).

### 3. Integridade (nada muda)
- Botões "Executar"/"Ver", "Configurar"/"Editar" (dialog de etapa), criação de instalação, filtro `tecnico_campo`, invalidações de query e navegação para `/instalacoes/etapa/:stageId` permanecem intactos — continuam funcionando normalmente dentro da visão filtrada.

## Arquivos tocados
- `src/components/layout/AppSidebar.tsx` (menu)
- `src/pages/instalacoes/Index.tsx` (filtro por URL, apenas)

## Validação
- Typecheck do projeto.
- Playwright: abrir o submenu, clicar em cada um dos 3 itens e confirmar que a listagem filtra pela etapa (cards só com a etapa correspondente) e que sem `?etapa` a listagem mostra as 3 etapas como hoje; conferir que "Executar" e "Configurar" seguem visíveis/funcionais.
