# Unificar "quem pode cancelar" nas Preventivas

## Estado atual confirmado (lido agora)
- Regras de edição no banco: exatamente as 6 esperadas, sem drift.
  - As 3 "Admins and coordinators can update ..." usam `is_admin_or_coordinator(auth.uid())`.
  - As 3 de técnico ficam como estão: dono da preventiva ou técnico da rota, técnico da rota nos itens, técnico designado na rota.
- Permissões de `minhas_rotas_listagem` hoje:
  - admin: pode excluir = sim
  - **coordenador_servicos: pode excluir = sim já hoje** (a investigação dizia não, então esse não muda)
  - coordenador_logistica: acesso = não, editar = não, excluir = não. **Esse é o único que muda.**
  - Todos os outros papéis: excluir = não
- De onde vem a permissão nas telas: nenhuma tela passa um valor diferente de `'minhas_rotas_listagem'`. As duas telas usam esse mesmo valor como padrão, então sempre caem nele. Não tem o bug da Corretiva, e não precisa corrigir nada.

## Mudanças

### Banco (uma migração)
1. Criar a função `can_cancel_preventiva(_user_id uuid)`, SECURITY DEFINER, `search_path=public`. Ela retorna verdadeiro para admin, ou para quem tem um papel com `can_delete` em `minhas_rotas_listagem`. Execução liberada só para `authenticated` e `service_role`, e retirada de PUBLIC e anon.
2. Recriar as 3 regras "Admins and coordinators can update ..." em preventive_maintenance, preventive_routes e preventive_route_items usando `can_cancel_preventiva(auth.uid())`. As 3 regras de técnico não mudam.
3. Gravar `can_delete=true` em `minhas_rotas_listagem` para admin, coordenador_servicos e coordenador_logistica. Na prática, só a logística muda.

### Telas
- **VisitaTecnica.tsx**: o botão de cancelar/excluir passa a depender de `canDelete('minhas_rotas_listagem')`, e não mais do papel fixo.
- **DetalheRota.tsx**: a coluna "Ações" e o seletor de status em cada item passam a usar o `canDeleteRoute` que já existe. O modo de edição da rota em elaboração (`isEditable`) e o cabeçalho continuam com a regra atual.
- **AtendimentoPreventivo.tsx / ExecucaoRota.tsx**: nada muda, já estão certos. O cancelamento de item em campo (`cancelMutation`/`cancelOffline`) e a regra de quem abre a página ficam intocados.

## Pontos de atenção
- **Coordenador de Logística e as regras antigas**: hoje a logística não passa por `is_admin_or_coordinator`. Com a mudança, passa a poder editar qualquer preventiva, rota ou item pelo banco. Isso é intencional, porque o cancelamento é uma edição.
- **Editar é mais do que cancelar**: as 3 regras cobrem toda edição, não só o cancelamento. Quem tiver "Excluir" marcado também poderá fazer outras edições nesses registros pelo banco. Se desmarcar "Excluir" de coordenador_servicos, ele perde todas as edições feitas por essas regras, como editar rota e reagendar item.
- **Logística não entra nas telas**: a logística continua com acesso = não em `minhas_rotas_listagem`, então talvez nem consiga abrir essas telas. O acesso à tela não será alterado sem você pedir.
- **Arquivos protegidos**: DetalheRota.tsx e AtendimentoPreventivo.tsx estavam na lista de não alterar. Aqui só DetalheRota.tsx muda, porque você pediu explicitamente, e só no ponto indicado.

## Verificação
- Checagem de tipos limpa.
- Consulta confirmando as regras novas e as permissões gravadas.
- Nada será publicado.
