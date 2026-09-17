# Plano: reorganização do menu lateral

## Objetivo
Reorganizar somente a apresentação da navegação, mantendo telas, rotas técnicas e regras de negócio existentes.

## Estrutura do menu

### Menu Principal
- Manter `Início`, `Minhas Rotas`, `Solicitação Peças` como entradas diretas quando o papel tiver acesso.
- Criar o submenu colapsável `CRM` com os itens hoje soltos:
  - `Dashboard CRM` → `/crm/dashboard`
  - `CRM Carteira` → `/crm/carteira`
  - `Visitas CRM` → `/crm/visitas`
  - `Pipeline` → `/crm/pipeline`
  - `Tarefas CRM` → `/crm/acoes`
- Manter `Inteligência` fora desse submenu, exatamente em `Administração`, como está hoje.
- Criar o submenu colapsável `Instalações Existentes` com:
  - seção/sub-submenu `Manutenção Preventiva`
    - `Clientes Preventiva` → `/preventivas`
    - `Rotas` → `/preventivas/rotas`
    - `Calendário Anual` → `/preventivas/calendario`
  - `Chamados` → `/chamados`
  - `Clientes` → `/crm/carteira`
  - `Visita Técnica` → `/visita-tecnica`
- Renomear o submenu visível `Oficina` para `Centro de Serviços`, sem alterar rotas `/oficina/*`, arquivos, componentes ou `permKeys` técnicos.

## Escolha da tela para “Clientes”
Usarei `/crm/carteira`, porque essa tela já oferece busca por cliente/fazenda/cidade e navega para a visão 360 do cliente (`/crm/:id`). A tela `/admin/clientes` é mais voltada a cadastro/administração.

## Permissões
- Reaproveitar os `menu_key` existentes para itens já existentes, preservando a visibilidade atual.
- Adicionar permissões para novos agrupamentos/itens que precisarem de chave própria, especialmente:
  - `instalacoes_existentes`
  - `visita_tecnica`
- Garantir que os papéis que já veem as telas movidas continuem vendo seus itens no novo local.
- Como a tabela de permissões já existe, a inclusão dessas linhas será feita como alteração de dados controlada no backend, sem mudar a estrutura da tabela.

## Títulos visíveis
Atualizar apenas os textos visíveis ao usuário que hoje mostram “Oficina” nas páginas solicitadas:
- `GestaoOS.tsx`: `Oficina · Gestão de OS` → `Centro de Serviços · Gestão de OS`
- `Atividades.tsx`: `Atividades de Oficina` → `Atividades do Centro de Serviços`

## Arquivos previstos
- `src/components/layout/AppSidebar.tsx`
- `src/pages/oficina/GestaoOS.tsx`
- `src/pages/oficina/Atividades.tsx`
- Permissões no backend para os novos `menu_key`s necessários

## Fora do escopo
- Não criar a tela de `Visita Técnica` nesta fase.
- Não mover nem alterar `Inteligência`.
- Não alterar lógica de negócio das telas existentes.
- Não alterar CRM, permissões de escrita, rotas técnicas `/oficina/*`, nomes de arquivos/componentes ou `permKeys oficina_*`.
- Não remover `Calendário Anual`.

## Validação
- Conferir que o menu abre os grupos corretos quando a rota atual pertence a eles.
- Conferir que `Calendário Anual` continua acessível dentro de `Manutenção Preventiva`.
- Conferir que `Inteligência` segue em `Administração`.
- Conferir que nenhuma tela movida perdeu acesso por falta de permissão.
