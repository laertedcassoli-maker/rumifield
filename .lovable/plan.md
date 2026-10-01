# Estoque Uso/Consumo — Fase 1 (banco + permissões)

Só banco e a tela de Permissões. Nenhuma rota, nenhum menu lateral, nada em `pecas`, nada publicado.

## 1. Migração (uma só)

**estoque_consumo_itens**
- id, codigo (único, obrigatório), descricao (obrigatória), peca_id (opcional, liga a `pecas`, ON DELETE SET NULL), ativo (padrão true), created_by_user_id, created_at, updated_at + gatilho `update_updated_at()` já existente.

**estoque_consumo_movimentos** (livro-razão imutável)
- item_id (ON DELETE RESTRICT), tipo (entrada/saida), quantidade > 0, local (centro_servicos/tecnico), tecnico_user_id com CHECK: obrigatório se local='tecnico', nulo se 'centro_servicos'.
- origem_tipo (inventario_inicial/carrinho/os/visita/pedido/ajuste), origem_id solto (sem FK), transacao_id, notes, created_by_user_id, created_at.
- Índices em (item_id, local, tecnico_user_id) e transacao_id para o cálculo de saldo. Saldo sempre calculado pela soma; sem coluna de saldo.

**Funções** (SECURITY DEFINER, STABLE, search_path=public, REVOKE PUBLIC/anon, GRANT authenticated/service_role), mesmo padrão das funções de cancelamento:
- `can_manage_estoque_consumo(uuid)`: admin OU can_edit em `estoque_uso_consumo`.
- `can_registrar_saida_estoque(uuid)`: admin OU can_delete em `estoque_uso_consumo`.

**Acesso** (GRANT SELECT/INSERT/UPDATE em itens e SELECT/INSERT em movimentos para authenticated; ALL para service_role; nada para anon)
- Itens: leitura para logados; criar/editar só com `can_manage_estoque_consumo`; sem exclusão.
- Movimentos: leitura para logados; inserir entrada exige `can_manage_estoque_consumo`, saída exige `can_registrar_saida_estoque`; sem UPDATE/DELETE.

## 2. Dados (role_menu_permissions)
menu_key `estoque_uso_consumo`, rótulo "Estoque Uso/Consumo", grupo `principal`:

| Papel | Acesso | Criar item/Dar entrada | Dar saída |
|---|---|---|---|
| admin | sim | sim | sim |
| coordenador_servicos | sim | sim | sim |
| tecnico_oficina | sim | sim | sim |
| tecnico_campo | sim | não | sim |

Outros papéis sem linha (sem acesso).

## 3. Tela de Permissões
Em `menuExtraColumns`, adicionar `estoque_uso_consumo`: can_edit "Criar item/Dar entrada", can_delete "Dar saída". Ajustar `columnsFor` para deduplicar por chave+rótulo (hoje deduplica só pela chave, e `instalacoes` já usa can_delete como "Excluir" no mesmo grupo — sem o ajuste, "Dar saída" seria engolida). Cada coluna extra só mostra interruptor na linha do seu menu.

## 4. Verificação
- Conferir as tabelas e os CHECKs por consulta.
- Simular inserções com cada papel (claims de usuário em transação com ROLLBACK): entrada passa para admin/coord_servicos/tec_oficina e falha para tec_campo; saída passa para os 4.
- types.ts regenerado automaticamente; typecheck limpo.

## Observação técnica
O pedido referencia `auth.users` em created_by_user_id e tecnico_user_id. Funciona, e é o mesmo padrão de outras tabelas do projeto; mantenho como especificado.
