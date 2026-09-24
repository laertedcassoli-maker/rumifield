# Instalações: Observações, Fotos da Visita, Encerrar Visita e Relatório Público

## O que muda para o usuário
- Pré Instalação e Instalação ganham, no checklist, os blocos **Observações** (Interna com cadeado "Apenas equipe" + Observação para Relatório) e **Fotos da Visita** (contador, compressão, grade, zoom), iguais aos da Preventiva.
- Botão **"Encerrar Visita"**, desabilitado com "Conclua o checklist para encerrar a visita" até 100%.
- Ao encerrar: observações vazias geram aviso (não bloqueia); zero fotos bloqueia.
- Só a **Instalação concluída** gera link de relatório público (cliente e interno), com card "Compartilhar relatório" na tela da etapa.

## Banco (uma migração)
- `installation_stages`: `observacao_interna text`, `observacao_externa text`, `public_token uuid DEFAULT gen_random_uuid() UNIQUE`. O token existe na linha, mas só é usado quando `stage = 'instalacao'`.
- Nova tabela `installation_visit_media` (stage_id, user_id, file_path, file_name, file_type, file_size, caption, created_at) — espelha preventive_visit_media; GRANTs + RLS (equipe autenticada lê; técnico/responsável da etapa e admin/coordenador inserem/excluem). Arquivos no bucket `preventive-media` em `{uid}/installation/{stageId}/...`.
- Função `is_public_installation_stage(_stage_id uuid)` SECURITY DEFINER: retorna true se a etapa é `instalacao`, está `concluido` e tem token. Políticas anon de leitura usando essa função em: installation_stages, installation_checklists, _blocks, _items, _item_nonconformities, _item_actions, installation_part_consumption, installation_visit_media (itens filhos resolvem o stage via join dentro de funções auxiliares, sem política direta aninhada).
- Leitura pública das fotos no storage: política anon em storage.objects restrita ao prefixo `*/installation/<stageId>/` de etapas públicas (ou URLs assinadas geradas via função, seguindo o que RelatorioCorretivo faz hoje — confirmar no build).

## Código
- Novos componentes paralelos (sem tocar nos da Preventiva): `components/instalacoes/InstallationObservationsBlock.tsx` e `InstallationVisitMediaUpload.tsx` (auto-save com props como valor inicial).
- `components/instalacoes/ChecklistExecution.tsx`: renderiza os dois blocos, troca o botão de conclusão por "Encerrar Visita" e adiciona as validações (aviso de observações, bloqueio sem fotos). Texto "Observação para Relatório" só menciona relatório na etapa instalacao.
- `pages/instalacoes/RelatorioInstalacao.tsx`: mesma estrutura visual de RelatorioPreventivo (cliente, datas, técnico, blocos/itens, não conformidades/ações, peças — custo só em `interno`, observação interna só em `interno`, fotos).
- `App.tsx`: rotas `/relatorio-instalacao/:token` e `/relatorio-instalacao/:token/:type` fora do AppLayout.
- `pages/instalacoes/ExecucaoEtapa.tsx`: card de compartilhar (copiar/abrir links cliente e interno) quando `stage === 'instalacao'` e `status === 'concluido'`; select passa a trazer as novas colunas.

## Não mexer
ObservationsBlock, VisitMediaUpload, preventive_maintenance, RelatorioPreventivo, RelatorioCorretivo, o bug de RLS da Preventiva, redirect pós-checklist e fluxo de aprovação da Pré Instalação.

## Verificação
Typecheck/build e abrir o link público em janela sem login para uma Instalação concluída de teste.
