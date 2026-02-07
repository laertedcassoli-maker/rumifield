

## Listar Acoes Completas no Cliente 360

Atualmente a secao "Pendencias" no Cliente 360 mostra apenas acoes abertas, sem possibilidade de editar ou ver detalhes. A ideia e substituir por uma listagem completa de acoes (abertas, em execucao e concluidas) com edicao inline via painel lateral, igual ao que ja existe na tela de Acoes CRM.

### O que muda

**Arquivo: `src/pages/crm/CrmCliente360.tsx`**

1. **Importar** o componente `EditarAcaoSheet` e os tipos `UnifiedAction` / `ActionStatus`
2. **Substituir a secao "Pendencias"** por uma secao "Acoes" que:
   - Mostra TODAS as acoes do cliente (abertas, em execucao e concluidas)
   - Agrupa visualmente: primeiro as abertas/em execucao, depois concluidas (com estilo atenuado)
   - Cada card e clicavel e abre o `EditarAcaoSheet` para edicao rapida de status, titulo, prazo, etc.
   - Exibe badge de status com cores (amarelo = pendente, azul = em execucao, verde = concluida)
   - Acoes concluidas aparecem com opacidade reduzida e texto tachado
3. **Adicionar estado** para controlar o `EditarAcaoSheet` (acao selecionada + open/close)
4. **Invalidar queries** apos edicao para manter dados atualizados

### Detalhes tecnicos

- Os dados ja estao disponiveis via `useCliente360Data(id)` que retorna `actions` (todas as acoes do cliente, sem filtro de status)
- Sera necessario mapear as acoes do formato `crm_actions` para o tipo `UnifiedAction` que o `EditarAcaoSheet` espera (adicionar campos `_source: 'action'`, `clientes`, `owner_name`, etc.)
- O `EditarAcaoSheet` ja invalida as queries `crm-actions-flat` e `crm-proposals-flat`; sera necessario tambem invalidar `crm-360-actions` para atualizar a listagem local
- Nenhuma mudanca no banco de dados necessaria

### Resultado

O consultor podera ver e gerenciar todas as acoes do cliente diretamente na tela 360, sem precisar navegar para a tela de Acoes CRM separada.
