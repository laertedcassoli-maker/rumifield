

## Tela de Acoes CRM (visao flat)

### O que e
Uma nova pagina `/crm/acoes` que lista todas as acoes de todos os clientes em uma unica tela, com filtros e ordenacao. Tanto o consultor quanto o gestor conseguem ver rapidamente o que esta pendente, vencido, ou concluido.

### Funcionalidades

1. **Listagem flat** de todas as acoes com:
   - Titulo da acao
   - Nome do cliente (com link para o 360)
   - Tipo (tarefa, pendencia, oportunidade)
   - Status (pendente, concluida, cancelada)
   - Prioridade
   - Prazo (com destaque visual se vencido)
   - Responsavel (para gestores que veem todos)

2. **Filtros**:
   - Status: Pendentes (padrao), Concluidas, Canceladas, Todas
   - Tipo: Todos, Tarefa, Pendencia, Oportunidade
   - Busca por texto (titulo ou nome do cliente)

3. **Ordenacao**: por prazo (mais urgentes primeiro), com vencidas no topo

4. **Permissoes**:
   - Consultor ve apenas suas acoes (filtro por `owner_user_id`)
   - Admin/Coordenador R+ ve todas as acoes, com nome do responsavel visivel

5. **Link no menu lateral**: "Acoes CRM" com icone `ListChecks`, usando a permissao `crm_clientes`

### Detalhes tecnicos

**Novo arquivo**: `src/pages/crm/CrmAcoes.tsx`

- Query na tabela `crm_actions` com join em `clientes` (para nome do cliente) e `profiles` (para nome do responsavel)
- Filtro por `owner_user_id` quando nao e admin/coordenador
- Componentes: Card-based (mobile-first), com badges de status e prioridade
- Acoes vencidas (due_at < now e status pendente) destacadas com borda/texto vermelho

**Alteracoes**:

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/crm/CrmAcoes.tsx` | Nova pagina com listagem, filtros e busca |
| `src/App.tsx` | Adicionar rota `/crm/acoes` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Acoes CRM" no menu principal |

**Query principal** (pseudocodigo):
```
supabase
  .from('crm_actions')
  .select('*, clientes!inner(id, nome), profiles!crm_actions_owner_user_id_fkey(nome)')
  .order('due_at', { ascending: true, nullsFirst: false })
```

Para consultores, adiciona `.eq('owner_user_id', user.id)`.

Nao requer alteracoes no banco de dados -- usa tabelas e RLS ja existentes.
