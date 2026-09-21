# Consolidar "Minhas Rotas" dentro de "Visita Técnica"

Levar para a tela **Visita Técnica** o que hoje só existe em Minhas Rotas (filtro Minhas/Todas, técnico, Pendentes/Concluídas e link de mapa) e então retirar "Minhas Rotas" do menu.

## O que muda na tela Visita Técnica

1. **Minhas / Todas** — um par de botões no topo dos filtros. Já vem em "Minhas" para técnico de campo e de oficina; nos outros perfis vem em "Todas".
2. **Técnico** — nova caixa de seleção, visível só para quem não é técnico (Admin e Coordenador de Serviços) e habilitada apenas quando o filtro está em "Todas". As opções são os técnicos que aparecem na própria lista já carregada, sem nenhuma busca extra.
3. **Pendentes / Concluídas / Todas** — novo grupo de botões, independente da caixa de Status detalhado que já existe. Concluída = finalizada/executado; Pendente = qualquer outro status.
4. **Ver no Google Maps** — um link por linha da tabela, traçando o caminho da cidade base da pessoa logada até a fazenda. Sem coordenadas cadastradas no cliente, o link aparece apagado com o aviso "Cliente sem coordenadas cadastradas".
5. **Chegar pré-filtrado por link** — `?meu=1` força "Minhas" e `?status=pendente` força o filtro Pendentes, para a futura entrada vinda de Minhas Pendências.

Filtros, colunas, paginação e cartões de resumo que já existem continuam iguais.

## Remoção de "Minhas Rotas"

- A entrada "Minhas Rotas" sai do menu lateral.
- A tela antiga e o diálogo de nova visita dela (usado só ali) são excluídos.
- O endereço antigo `/preventivas/minhas-rotas` passa a redirecionar para Visita Técnica, porque três lugares ainda apontam para ele (botões "Voltar" da execução de preventiva e da tela de atendimento). Assim ninguém cai em página inexistente.
- O atalho "Minhas Rotas" da tela inicial passa a apontar para Visita Técnica já filtrada em Minhas + Pendentes.
- As permissões (`minhas_rotas`) ficam como estão; só o item de menu sai.

## Detalhes técnicos

- `src/pages/VisitaTecnica.tsx`:
  - `VisitaItem` ganha `tecnicoUserId` (de `field_technician_user_id` / `preventive_routes.field_technician_user_id`) e `clienteLat`/`clienteLon` (`latitude`, `longitude` adicionados ao `select` de `fetchClientesMap`).
  - `ownerFilter` (`'minhas' | 'todas'`) com default por papel; `tecnicoFilter` (string, `'all'`); `situacaoFilter` (`'pendentes' | 'concluidas' | 'todas'`).
  - `uniqueTechnicians` derivado de `lista` via `useMemo`, mesmo padrão de `uniqueClients`.
  - `useSearchParams` lido uma vez na inicialização do estado (`meu=1` → `minhas`; `status=pendente` → `pendentes`).
  - Query nova `['user-profile-cidade-base', user?.id]` em `profiles` (`cidade_base`, `cidade_base_lat`, `cidade_base_lon`), com fallback Piracicaba/SP, e `buildSingleDestinationUrl(lat, lon)` — copiados de `MinhasRotas.tsx`.
  - Nova coluna "Mapa" na tabela com `Tooltip` + `MapIcon`, estado desabilitado quando faltam coordenadas.
  - Os três novos filtros entram no `useMemo` de `filtradas` e resetam `currentPage`.
- `src/App.tsx`: remove o import de `MinhasRotas`; `/preventivas/minhas-rotas` passa a `<Navigate to="/visita-tecnica" replace />`.
- `src/components/layout/AppSidebar.tsx`: remove o item; mantém o ajuste de `isPreventivasActive`.
- `src/pages/Home.tsx`: `url` do cartão passa a `/visita-tecnica?meu=1&status=pendente`.
- Excluídos: `src/pages/preventivas/MinhasRotas.tsx`, `src/components/chamados/NovaVisitaDiretaDialog.tsx`.
- Intocados: `NovaVisitaTecnicaDialog.tsx`, `role_menu_permissions`, telas de execução de preventiva/corretiva.
