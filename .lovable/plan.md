# Relatório público de Preventiva/Corretiva — liberar leitura sem login

## O que foi confirmado no banco
- As 7 tabelas do relatório (checklists, blocos, itens, não conformidades, ações, peças, fotos) **não têm nenhuma permissão para visitante sem login** — por isso o link mostra só o cabeçalho.
- 6 delas têm hoje uma política de leitura "USING (true)" para todos os papéis (nome diz "Authenticated", mas vale para qualquer um). Só não vaza porque falta a permissão de visitante. Não serão alteradas (fora do escopo).
- Ligações: `preventive_checklists.preventive_id`, `blocks.checklist_id`, `items` via bloco, `nonconformities/actions.exec_item_id`, `part_consumption.preventive_id`, `visit_media.preventive_id`.
- O relatório Corretivo lê as mesmas tabelas `preventive_*` a partir de um `preventive_maintenance` vinculado à visita; o token público da corretiva fica em `corrective_maintenance`.

## Migração
1. Funções SECURITY DEFINER (search_path=public, STABLE):
   - `is_public_preventive_visit(_preventive_id)` — verdadeiro se o `preventive_maintenance` tem `public_token` **ou** está vinculado a uma corretiva com `public_token` (ligação exata será confirmada lendo `RelatorioCorretivo.tsx` antes de aplicar).
   - Auxiliares `preventive_id_of_checklist(_checklist_id)`, `preventive_id_of_block(_block_id)`, `preventive_id_of_item(_item_id)` — resolvem o join sem política aninhada.
2. `GRANT SELECT ... TO anon` nas 7 tabelas (incluindo `preventive_checklists`, necessária para o relatório encontrar o checklist).
3. Políticas `FOR SELECT TO anon`:
   - checklists, part_consumption, visit_media: `is_public_preventive_visit(preventive_id)`
   - blocks: via `preventive_id_of_checklist(checklist_id)`
   - items: via `preventive_id_of_block(block_id)`
   - nonconformities, actions: via `preventive_id_of_item(exec_item_id)`
4. Fotos: conferir a política de leitura anônima do bucket `preventive-media` para os caminhos das fotos de preventiva/corretiva; se faltar, adicionar leitura anon restrita a esses caminhos.

## O que não muda
Páginas de relatório, políticas de escrita e políticas atuais de usuários logados.

## Validação
Abrir, via Playwright sem sessão, um link de preventiva e um de corretiva concluídos e confirmar checklist, não conformidades, peças e fotos na tela.
