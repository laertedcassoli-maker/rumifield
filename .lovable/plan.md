# Instalações: campos obrigatórios na configuração + ajustes nos critérios de aprovação

## 1. Configurar etapa (tela de Instalações)

- Data planejada e Template de checklist passam a ser **obrigatórios** nas duas etapas (Pré Instalação e Instalação). Rótulos ganham `*` e o botão Salvar mostra aviso claro quando faltar um deles (sem desabilitar o botão).
- Na etapa **Instalação**, aparece também um campo **Data fim**, obrigatório junto com a data início. Validação: a data fim não pode ser anterior à data início.
- Na etapa **Pré Instalação**, o template já vem escolhido como "CheckList - Pré Instalação" (localizado pelo nome no catálogo existente); o usuário pode trocar. Na Instalação continua sem pré-seleção.
- Nada muda no responsável (Técnico/CSM), no anexo de e-mail de venda, nos filtros ou na listagem.

## 2. Banco

- Nova coluna `planned_date_end` (date, aceita vazio) em `installation_stages`, usada só pela etapa Instalação.
- As colunas `aprovacao_data_inicio` / `aprovacao_data_fim` **permanecem** no banco — apenas deixam de ser usadas na interface.

## 3. Tela da etapa (critérios de aprovação)

- O bloco "Critérios de aprovação" passa a aparecer somente quando a etapa está em **Aguardando Aprovação** ou **Concluído**. Durante a execução do checklist, o bloco não aparece.
- Os três níveis de acesso (editar / apenas ver / não ver) continuam exatamente como hoje.
- Dentro do bloco, os campos manuais de início e fim da janela de aprovação são removidos. No lugar, uma linha só de leitura com a **data da aprovação** (registrada automaticamente quando a etapa é aprovada), exibida para histórico; quando ainda não houver aprovação, mostra "Ainda não aprovada".
- Quando a etapa é Instalação, a listagem e a tela da etapa mostram o período (início – fim) em vez de uma data única.

## Detalhes técnicos

- Migration: `ALTER TABLE public.installation_stages ADD COLUMN planned_date_end date;` (sem mudança de RLS/grants).
- `Index.tsx`: novo estado `stagePlannedDateEnd`; incluído em `openStageDialog` (a partir de `existing?.planned_date_end`), no `payload` de `saveStageMutation` (`planned_date_end: stageDialog.stage === 'instalacao' ? (stagePlannedDateEnd || null) : null`), no `select` da query `['installations']` e no tipo `StageRow`. Validação no `onClick` do Salvar: responsável (atual) + `!stagePlannedDate` + `!stageTemplateId` + para `instalacao` `!stagePlannedDateEnd` e `stagePlannedDateEnd < stagePlannedDate`, cada caso com `toast.error` específico.
- `ExecucaoEtapa.tsx`: adicionar `planned_date_end` ao select; render do form passa a `stage.stage === 'pre_instalacao' && podeVerCriterios && ['aguardando_aprovacao','concluido'].includes(stage.status)`; passar `approvedAt={stage.approved_at}` ao form; exibir período quando `planned_date_end` existir.
- `AprovacaoPreInstalacaoForm.tsx`: remover estados/inputs `dataInicio`/`dataFim`, sua validação e as chaves `aprovacao_data_inicio`/`aprovacao_data_fim` do objeto salvo (tipo `AprovacaoCriterios` ajustado); nova prop `approvedAt?: string | null` renderizada como texto somente leitura. `criteriosPendentes` e os gates de edição permanecem inalterados.
