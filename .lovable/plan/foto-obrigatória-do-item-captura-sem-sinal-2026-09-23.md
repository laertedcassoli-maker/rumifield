# Foto obrigatória do item: captura sem sinal

## O que muda para o técnico
- Sem sinal, "Anexar foto" guarda a foto no próprio aparelho. O item mostra a foto na hora e o selo "Aguardando envio" no lugar de "Pendente".
- Quando o sinal volta, a foto sobe sozinha. Isso acontece ao reconectar, ao abrir o checklist e antes de concluir. Aí o selo vira "Anexada".
- Concluir o checklist continua pedindo sinal, como hoje nas três telas. Na conclusão, as fotos que estão esperando no aparelho sobem primeiro. Só se uma delas falhar é que a conclusão é bloqueada, com um aviso claro.
- A regra de foto obrigatória não muda: continua valendo em preventiva, corretiva e instalação.

## Detalhes técnicos
- **Armazenamento local:** nova tabela `checklistItemPhotos` no Dexie (`offline-checklist-db.ts`, versão 8), com chave = id do item e os campos `table`, `blob`, `mimeType`, `ext`, `userId`, `createdAt`, `_pendingSync`. É compartilhada pelas duas tabelas de itens (preventiva e instalação), então não precisa de outro banco.
- **ChecklistItemPhoto.tsx:**
  - Ao escolher o arquivo, grava primeiro no Dexie e mostra a prévia com `URL.createObjectURL`.
  - Se houver sinal, chama `syncItemPhoto(itemId)` logo em seguida. Se não houver, fica na fila.
  - O estado vem de `useLiveQuery` (foto local) mais a busca atual de `photo_path` (foto já enviada).
  - Remover uma foto que ainda está só no aparelho apaga o registro local.
  - Sai a mensagem que recusava anexar sem sinal.
- **syncItemPhoto / syncPendingItemPhotos** (novo `src/lib/checklist-item-photo-sync.ts`):
  - Envia para `preventive-media` em `{uid}/checklist-items/{itemId}.{ext}` com `upsert`, o que torna a nova tentativa segura.
  - Depois atualiza `photo_path` com `.select('id')` para detectar falha silenciosa de permissão, tudo com limite de 15s.
  - Só apaga o registro local depois de confirmar o envio. Em caso de erro, o registro fica para a próxima tentativa.
  - É disparado pelo evento `online`, ao montar o componente e dentro de `assertRequiredPhotos`.
- **assertRequiredPhotos:**
  - Antes de checar, roda `syncPendingItemPhotos` para os itens daquele checklist.
  - Um item sem `photo_path` no servidor que tem foto no aparelho não é tratado como "foto faltando". Se ela não conseguir subir, o erro diz "foto ainda não enviada, tente novamente".
- **Sem mudanças:** a regra de `requires_photo`, as telas de conclusão e o bloqueio de concluir sem sinal. Também ficam como estão as fotos finais da visita (VisitMediaUpload), AtendimentoPreventivo.tsx e ExecucaoVisitaCorretiva.tsx.

## Validação
- Checagem de tipos.
- Playwright com o contexto em modo offline:
  1. Anexar foto num item obrigatório e ver a prévia com "Aguardando envio".
  2. Voltar online e confirmar que `photo_path` foi gravado e que o registro local sumiu.
  3. Concluir o checklist sem ver o erro de foto faltando.
