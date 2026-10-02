# Liberar Processar/Concluir pedido para quem tem permissão de Pedidos

## Auditoria (regras reais no banco hoje)

| Tabela | Gravação no Processar/Concluir | Regras atuais de escrita | Bloqueia quem tem can_manage_pedidos? |
|---|---|---|---|
| pedido_item_assets | insert/upsert e delete dos lacres/DD | ALL is_admin_or_coordinator; INSERT só solicitante; DELETE solicitante ou admin/coord_logistica/coord_servicos | **Sim** (causa do erro) |
| pedido_itens | update de workshop_item_id / asset_codes depois de vincular ativos | UPDATE is_admin_or_coordinator ou solicitante; INSERT is_admin_or_coordinator ou solicitante | **Sim** (UPDATE falharia logo em seguida; INSERT não é usado nesse fluxo) |
| pedidos | update de status, NF, logística | UPDATE can_manage_pedidos (já ajustado) | Não |
| pedido_status_history | gravado pelo gatilho com privilégio próprio | — | Não |
| pedido_item_log | insert com user_id = próprio usuário | INSERT auth.uid() = user_id | Não |
| workshop_items | só leitura neste fluxo | INSERT/UPDATE abertos a authenticated | Não |

## O que será feito (só acréscimos no banco)
1. pedido_item_assets: novas regras de INSERT, UPDATE e DELETE para authenticated com `can_manage_pedidos(auth.uid())` (USING e WITH CHECK).
2. pedido_itens: nova regra de UPDATE para authenticated com `can_manage_pedidos(auth.uid())` (USING e WITH CHECK). INSERT/DELETE ficam como estão.
3. Nenhuma regra existente é removida; nada para anon; nada com `true`; SELECT, tela de Pedidos e tela de Permissões intocadas.

## Teste
- Conferir em pg_policies as novas regras.
- Simular no banco, como Bruno Oliveira (Técnico Oficina, com Editar em Envios), um insert/upsert/delete em pedido_item_assets e update em pedido_itens do SP-00000664 dentro de transação desfeita (sem alterar dados reais).
- Simular o mesmo como um usuário sem a permissão e não dono: deve ser recusado.
- Dono e admin/coordenador seguem pelas regras atuais, que não mudam.
- Teste na tela com a conta do Bruno não é possível daqui (só tenho a sessão de admin); peço que ele conclua o SP-00000664 depois.

Nada será publicado (a mudança no banco vale na hora, inclusive no app publicado).
