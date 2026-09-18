# Plano: ícone de Novas Instalações e ordem do submenu Instalações Existentes

## Escopo
Apenas apresentação no `src/components/layout/AppSidebar.tsx`. Nenhuma permKey, rota, tela, migration ou lógica de acesso é alterada.

## Tarefa 1 — Ícone de "Novas Instalações"
- Adicionar `House` ao import de `lucide-react` (linha 2). `HardHat` permanece no import porque o item "Instalação" (linha 55) continua usando-o.
- Trocar `<HardHat className="h-4 w-4" />` por `<House className="h-4 w-4" />` no trigger do submenu "Novas Instalações" (linha 244).
- `House` é visualmente distinto do `Home` usado em "Início".

## Tarefa 2 — Ordem em "Instalações Existentes"
- Reordenar o array `installationItems` (linhas 101-105) para:
  1. Chamados (`/chamados`)
  2. Visita Técnica (`/visita-tecnica`)
  3. Clientes (`/crm/carteira`)
- O submenu "Preventivas" já é renderizado antes do map de `installationItems` (linhas 280-306), então a ordem final fica: Preventivas → Chamados → Visita Técnica → Clientes.

## Fora do escopo
- Não alterar ícone de "Instalações Existentes" (MapPin), "Início" (Home), nem o item "Instalação" (HardHat).
- Não alterar o conteúdo do submenu "Preventivas".
- Não alterar permKeys, rotas, `isClienteRouteActive`, `isInstallationsActive` ou qualquer lógica de visibilidade.

## Validação
- `bunx tsgo --noEmit` + build log limpos.
- Playwright no preview: "Novas Instalações" com ícone de casa; ordem dentro de "Instalações Existentes" conferida; badge/contador e ativos do menu intactos.
