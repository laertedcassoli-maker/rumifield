# Instalações: fluxo começa em Pré Instalação

Remove "Pré Venda" da interface, permite escolher Técnico **ou** CSM como responsável da etapa, adiciona o anexo do e-mail de venda na Pré Instalação e faz a conclusão da Pré Instalação ficar aguardando aprovação do Coordenador de Serviços.

## 1. Menu lateral

- No submenu "Novas Instalações", ficam apenas "Pré Instalação" e "Instalação". O item "Pré Venda" sai da lista (nenhuma permissão, rota ou ícone dos outros itens muda).

## 2. Tela de Instalações

- Criar uma instalação sem filtro ativo abre direto a configuração de **Pré Instalação**.
- No dialog de configuração da etapa, um seletor "Tipo de responsável" com duas opções:
  - **Técnico** — lista de técnicos de campo ativos (comportamento atual).
  - **CSM** — lista de consultores R+ ativos.
  - Ao trocar o tipo, o responsável do outro tipo é limpo: só um dos dois fica gravado.
- Somente na etapa **Pré Instalação**, um campo "E-mail de venda" (anexo opcional):
  - Envio do arquivo para a área privada de anexos de instalação, organizado pela etapa.
  - Quando já existe anexo: um clique abre a pré-visualização em uma janela sobreposta (imagem exibida direto; outros formatos mostram nome do arquivo e botão para abrir); duplo clique abre o arquivo em uma nova guia.
  - Como o arquivo é guardado na pasta da etapa, o anexo fica disponível depois que a etapa é salva pela primeira vez; ao configurar uma etapa nova aparece um aviso curto pedindo para salvar antes de anexar.
- Nada muda no filtro por etapa, na listagem, na exclusão, nas permissões ou na visão do técnico de campo.

## 3. Conclusão do checklist

- Ao concluir o checklist de uma etapa **Pré Instalação**, a etapa passa para "aguardando aprovação" e a instalação **não** é marcada como concluída.
- Na etapa **Instalação** (e qualquer outro tipo), tudo continua como hoje: etapa concluída e, se todas as etapas estiverem concluídas, a instalação também.
- Textos ajustados: na Pré Instalação a confirmação avisa que a etapa segue para aprovação do Coordenador de Serviços e o aviso de sucesso diz "Checklist enviado para aprovação!".
- A conclusão continua exigindo conexão e a sincronização completa das alterações feitas offline.

## Detalhes técnicos

- `AppSidebar.tsx`: remover a entrada `pre_venda` de `instalacoesItems`.
- `Index.tsx`:
  - `openStageDialog(data.id, etapaFiltro ?? 'pre_instalacao')`.
  - Incluir `csm_user_id, sales_email_attachment_path` no `select` de `installation_stages` da query `['installations']` e no tipo `StageRow`.
  - Novo estado `stageResponsavelTipo: 'tecnico' | 'csm'` + `stageCsmId`; `openStageDialog` deriva o tipo a partir de `existing.csm_user_id`.
  - Query `['pedidos-responsaveis','consultor_rplus']` via RPC `list_pedidos_responsaveis`.
  - `saveStageMutation` grava `technician_user_id`/`csm_user_id` mutuamente exclusivos (um deles sempre `null`).
  - Upload via `supabase.storage.from('instalacao-anexos').upload(`${stageId}/${Date.now()}-${nome}`)`; preview e nova guia com `createSignedUrl` (bucket privado); clique único/duplo diferenciados com timer curto.
- `ChecklistExecution.tsx` (instalações): no `completeChecklistMutation`, o `update` de `installation_stages` passa a `.select('installation_id, stage')`; se `stage === 'pre_instalacao'`, grava `status: 'aguardando_aprovacao'` e pula a checagem de irmãos/conclusão da instalação. Status da etapa lido do registro já carregado para escolher os textos.
- Sem mudanças de schema, RLS ou no motor offline (`useOfflineInstallationChecklist`), e sem implementar a aprovação em si.

## Observação

Etapas atribuídas a um CSM não aparecem hoje na listagem de um `tecnico_campo` (o filtro dele considera só `technician_user_id`) — correto para este escopo; a visão do CSM pode ser tratada num próximo passo.
