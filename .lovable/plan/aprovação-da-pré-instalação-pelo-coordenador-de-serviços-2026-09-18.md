# Aprovação da Pré Instalação pelo Coordenador de Serviços

Fluxo: ao concluir a Pré Instalação, a etapa fica "Aguardando Aprovação". Só o Coordenador de Serviços (ou admin) aprova, revisando responsável, dados e o anexo do e-mail de venda. A etapa Instalação só pode ser configurada depois dessa aprovação.

## Tela de revisão da etapa (ExecucaoEtapa)

- Passa a carregar também o CSM responsável e o anexo do e-mail de venda.
- Responsável: se houver CSM, mostra "Nome (CSM)"; senão mostra o técnico como hoje.
- Anexo "E-mail de venda": um clique abre a pré-visualização na própria tela, dois cliques abrem o arquivo em outra guia — mesmo comportamento já existente na lista.
- Quando a Pré Instalação está aguardando aprovação:
  - Coordenador de Serviços / admin: botão "Aprovar Pré Instalação" com confirmação. Ao confirmar, a etapa passa a "Concluído" com registro de quem aprovou e quando, e a tela/lista atualizam com aviso de sucesso "Pré Instalação aprovada!".
  - Outros papéis (CSM, técnico, coordenador R+): apenas um aviso informativo de que a etapa está aguardando revisão do Coordenador de Serviços, sem botão.
- Sem fluxo de reprovar/devolver neste momento.

## Lista de instalações

- Etapa aguardando aprovação passa a ter botão "Ver" (somente leitura), igual a uma etapa concluída — não reabre para execução.
- Etapa "Instalação": o botão Configurar/Editar só aparece habilitado quando a Pré Instalação existir e já estiver aprovada (Concluído). Caso contrário, no lugar do botão aparece um texto curto: "Configure a Pré Instalação primeiro" (quando ela não existe) ou "Aguardando aprovação da Pré Instalação" (quando existe mas ainda não foi aprovada).
- No dialog de configuração da etapa Instalação, a opção "CSM" desaparece — Instalação é sempre de um técnico.
- O selo "Aguardando Aprovação" ganha cor âmbar distinta, tanto na lista quanto na tela da etapa.

## Detalhes técnicos

- `src/hooks/useAnexoPreview.ts` (novo): extrai a lógica compartilhada de anexo — `getSignedUrl` (bucket `instalacao-anexos`, 1h), `handleClick` (timer 260ms → estado `preview`), `handleDoubleClick` (`window.open`) e o estado do modal; `Index.tsx` e `ExecucaoEtapa.tsx` passam a consumir o hook, e o Dialog de pré-visualização é extraído para `src/components/instalacoes/AnexoPreviewDialog.tsx` usado nas duas telas (remove a duplicação atual das linhas 354-388 e 754-781 de Index.tsx).
- `ExecucaoEtapa.tsx`: select da query `['installation-stage', stageId]` ganha `csm_user_id, sales_email_attachment_path`; query de nome passa a usar `stage.csm_user_id ?? stage.technician_user_id` com flag `isCsm`; `useAuth()` fornece `role`/`user`; `canApprove = role === 'coordenador_servicos' || role === 'admin'`; `approveMutation` faz `update installation_stages set status='concluido', approved_by=user.id, approved_at=new Date().toISOString()` filtrando por `id=stageId`, com `.select('id')` para detectar falha silenciosa de RLS, e invalida `['installation-stage', stageId]`, `['installation-stage-type', stageId]` e `['installations']`; AlertDialog de confirmação simples.
- `STAGE_STATUS_LABELS`/badge de ExecucaoEtapa e `STAGE_STATUS_VARIANTS` de Index: `aguardando_aprovacao` renderizado com classe âmbar via token (`bg-amber-500/15 text-amber-700 border-amber-500/30` sobre variant `outline`) para não introduzir cor fixa fora do padrão de badge.
- Index.tsx: `isReadOnlyStatus = ['concluido','aguardando_aprovacao'].includes(stage.status)` controla variant/label do botão; trava da Instalação calculada por `inst.stages.find(s => s.stage === 'pre_instalacao')`; dialog oculta o botão "CSM" quando `stageDialog?.stage === 'instalacao'` e força `stageResponsavelTipo='tecnico'` em `openStageDialog` nesse caso.
- Sem alteração de schema, RLS, motor offline ou lógica de execução do checklist.
