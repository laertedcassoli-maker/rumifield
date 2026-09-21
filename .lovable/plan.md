# Instalações — exclusão por etapa e formulário de aprovação da Pré Instalação

## O que muda para o usuário

### 1. Excluir/editar por etapa (lista de Instalações)

Cada etapa do cartão ganha suas próprias ações, além do botão já existente de excluir a instalação inteira (que continua igual):

| Etapa | Ação | Quem vê |
| --- | --- | --- |
| Instalação | Excluir etapa | Admin, Coordenador de Serviços |
| Pré Instalação | Excluir etapa | Admin, Coordenador de Serviços, Coordenador R+, Consultor R+ |
| Pré Instalação | Editar etapa (diálogo já existente) | Admin, Coordenador de Serviços, Coordenador R+, Consultor R+ |

A exclusão pede confirmação e avisa que o checklist e os dados daquela etapa vão junto. O botão "Configurar" de uma etapa que ainda não existe continua com a regra atual.

### 2. Formulário de aprovação da Pré Instalação

Na tela da etapa de Pré Instalação, um novo bloco "Critérios de aprovação", visível e editável **apenas para o Coordenador de Serviços**:

- Tem equipamento? (Sim / Não / NA) + Nome do equipamento
- Tem químico? (Sim / Não / NA)
- Quantidade de pistolas + Pistolas em estoque? (Sim / Não / NA)
- Quantidade de install kit + Install kit em estoque? (Sim / Não / NA)
- Metragem de mangueira (ft) + Mangueira em estoque? (Sim / Não / NA)
- Janela da aprovação: data de início e data de fim (independente da data planejada da etapa, que continua como está)
- Técnico responsável pela instalação: reaproveita o responsável já gravado na etapa

Comportamento:

- "Salvar rascunho" grava a qualquer momento e permite voltar e editar depois.
- Se **todos** os campos Sim/Não/NA estiverem em "Sim" ou "NA", o botão de aprovar a Pré Instalação fica liberado (mantendo a exigência atual de etapa em "Aguardando Aprovação").
- Se **qualquer** campo estiver em "Não" (ou em branco), os dados são salvos mas a etapa permanece em "Aguardando Aprovação", com aviso explícito de quais itens travam a aprovação.

Os demais papéis continuam vendo a etapa normalmente, sem o formulário; o aviso "aguardando revisão do Coordenador de Serviços" segue como hoje.

## Decisões assumidas

- O formulário fica na tela da etapa (`/instalacoes/etapa/:stageId`), junto do bloco de aprovação já existente — não em um novo diálogo na lista.
- Hoje quem aprova é Coordenador de Serviços **ou** Admin. Com a mudança, o formulário é só do Coordenador de Serviços; o Admin continua podendo aprovar (sem editar os critérios), para não travar suporte.
- Campos numéricos aceitam vazio (rascunho) e não bloqueiam a aprovação por si — só os campos Sim/Não/NA travam.

## Detalhes técnicos

**Migration** (`installation_stages`, todas as colunas anuláveis, preenchidas só quando `stage='pre_instalacao'`):

- `tem_equipamento text`, `nome_equipamento text`
- `tem_quimico text`
- `qtd_pistolas integer`, `pistolas_em_estoque text`
- `qtd_install_kit integer`, `install_kit_em_estoque text`
- `qtd_mangueira_ft numeric`, `mangueira_em_estoque text`
- `aprovacao_data_inicio date`, `aprovacao_data_fim date`

Os campos tri-state usam CHECK `in ('sim','nao','na')` (aceitando null). Sem mudança de RLS: as políticas atuais (`can_manage_installations()` para ALL, técnico/CSM responsável para UPDATE) já cobrem admin, coordenadores e consultor R+; os gates novos são de UI. `planned_date` e o fluxo da etapa `instalacao` ficam intocados. Tipos Supabase regenerados após a migration.

**`src/pages/instalacoes/Index.tsx`**

- Novos gates: `podeExcluirEtapaInstalacao = admin || coordenador_servicos`; `podeGerenciarPreInstalacao = admin || coordenador_servicos || coordenador_rplus || consultor_rplus`. `canManage` e `deleteInstallationMutation` ficam como estão.
- `deleteStageMutation`: `delete().eq('id', stageId).select('id')` com throw explícito quando nenhuma linha volta (RLS silenciosa), invalidando `['installations']`.
- Novo `AlertDialog` de confirmação por etapa (estado `etapaParaExcluir`), separado do diálogo de exclusão da instalação.
- No bloco de ações de cada etapa, ícone de lixeira conforme a tabela acima; o botão "Editar" da Pré Instalação passa a usar `podeGerenciarPreInstalacao`.

**`src/pages/instalacoes/ExecucaoEtapa.tsx`**

- Query da etapa passa a selecionar as novas colunas.
- Novo componente `src/components/instalacoes/AprovacaoPreInstalacaoForm.tsx`: estado local inicializado a partir da etapa (props como valor inicial, sem `useEffect` de sincronização), `ToggleGroup` para os tri-state, `Input` para números e datas, mutation de rascunho com `.select('id')` e timeout padrão, invalidando `['installation-stage', stageId]` e `['installations']`.
- `criteriosCompletos` = todos os cinco tri-state em `sim`/`na`; o botão "Aprovar Pré Instalação" só habilita quando verdadeiro, e o bloco lista os itens pendentes quando não. O `approveMutation` atual não muda.
- Botões permanecem clicáveis com toast explicativo quando a validação falha, conforme o padrão do projeto.

## Fora do escopo

- Botão/gate de exclusão da instalação inteira.
- `planned_date` e seu uso pelas outras etapas.
- Fluxo de aprovação/execução da etapa de Instalação e o checklist em si.
