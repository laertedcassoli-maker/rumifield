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

## 4. Pedidos: aviso de possível duplicidade

- Ao enviar uma solicitação, depois de todas as validações atuais e antes da confirmação final, o sistema procura, para cada peça do pedido, outro pedido do mesmo cliente com a mesma peça criado nos últimos 7 dias (ignorando rascunhos e itens cancelados).
- Se encontrar, aparece um aviso "Possível duplicidade" listando as peças em conflito, com "Revisar" (fecha e não envia) e "Continuar mesmo assim" (segue para a confirmação normal). O aviso nunca bloqueia o envio; se a checagem falhar, o fluxo segue normalmente.

## 5. Visita Técnica: excluir e editar na lista

- Na coluna "Ações", além de visualizar, Admin e Coordenador de Serviços passam a ver:
  - **Excluir** (lixeira, com confirmação): remove a visita corretiva ou o item de rota preventiva da linha; a lista recarrega.
  - **Editar**: em corretiva abre o diálogo já existente (data, técnico, checklist); em preventiva leva direto para a tela de atendimento, onde a edição já existe.
- Outros papéis continuam vendo apenas o ícone de visualizar.

## Detalhes técnicos



- Migration: `ALTER TABLE public.installation_stages ADD COLUMN planned_date_end date;` (sem mudança de RLS/grants).
- `Index.tsx`: novo estado `stagePlannedDateEnd`; incluído em `openStageDialog` (a partir de `existing?.planned_date_end`), no `payload` de `saveStageMutation` (`planned_date_end: stageDialog.stage === 'instalacao' ? (stagePlannedDateEnd || null) : null`), no `select` da query `['installations']` e no tipo `StageRow`. Validação no `onClick` do Salvar: responsável (atual) + `!stagePlannedDate` + `!stageTemplateId` + para `instalacao` `!stagePlannedDateEnd` e `stagePlannedDateEnd < stagePlannedDate`, cada caso com `toast.error` específico.
- `ExecucaoEtapa.tsx`: adicionar `planned_date_end` ao select; render do form passa a `stage.stage === 'pre_instalacao' && podeVerCriterios && ['aguardando_aprovacao','concluido'].includes(stage.status)`; passar `approvedAt={stage.approved_at}` ao form; exibir período quando `planned_date_end` existir.
- `AprovacaoPreInstalacaoForm.tsx`: remover estados/inputs `dataInicio`/`dataFim`, sua validação e as chaves `aprovacao_data_inicio`/`aprovacao_data_fim` do objeto salvo (tipo `AprovacaoCriterios` ajustado); nova prop `approvedAt?: string | null` renderizada como texto somente leitura. `criteriosPendentes` e os gates de edição permanecem inalterados.
- Pré-seleção do template: em `openStageDialog`, quando `stage === 'pre_instalacao'` e não há `existing.checklist_template_id`, usar `templates?.find(t => t.name === 'CheckList - Pré Instalação')?.id ?? ''` (sem UUID fixo); como `templates` é carregado por query, aplicar o fallback também na abertura do diálogo caso a lista chegue depois (derivar o valor efetivo do Select sem `useEffect` de sincronização de estado).
- `Pedidos.tsx`: `handleShowConfirmation` passa a `async`; após as validações, `supabase.from('pedido_itens').select('peca_id, pedidos!inner(id, codigo, cliente_id, status, created_at)').in('peca_id', itens.map(i => i.peca_id)).is('cancelled_at', null)` filtrando `pedidos.cliente_id = form.cliente_id`, `pedidos.status != 'rascunho'`, `pedidos.created_at >= now-7d` e excluindo `editingPedido?.id`; resultado não vazio → `setDuplicateWarning({ itens: [...] })` em vez de `setShowConfirmation(true)`. Novo `AlertDialog` (padrão do diálogo de exclusão, ~linha 3156) com `AlertDialogCancel` "Revisar" e `AlertDialogAction` "Continuar mesmo assim" → limpa o aviso e chama `setShowConfirmation(true)`. Erro na checagem é engolido (`catch` → segue para confirmação).
- `VisitaTecnica.tsx`: `podeGerenciarVisita = role === 'admin' || role === 'coordenador_servicos'`; adicionar `checklist_template_id` ao select da query de corretivas e propagar no objeto da linha (`Visita` ganha `checklistTemplateId`, `plannedDate`, `technicianId` conforme já disponíveis). Novos estados `visitaParaExcluir` e `visitaParaEditar`; `deleteVisitaMutation` faz `from(tipo === 'corretiva' ? 'ticket_visits' : 'preventive_route_items').delete().eq('id', id).select('id')` com throw se 0 linhas, e invalida `['visita-tecnica']`. Ícones `Pencil`/`Trash2` (ghost, `h-4 w-4`) na coluna Ações apenas quando `podeGerenciarVisita`; editar corretiva monta `EditarVisitaCorretivaDialog` existente, editar preventiva chama `navigate(v.linkTo)`. Nenhuma alteração em `ExecucaoVisitaCorretiva.tsx`, `AtendimentoPreventivo.tsx` ou `DetalheRota.tsx`.
