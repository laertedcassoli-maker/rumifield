

## Tornar a tela Acoes CRM editavel

### O que muda

Ao clicar em um card de acao ou proposta, abre um **sheet lateral (drawer)** com os detalhes completos e opcoes de edicao inline -- sem navegar para outra pagina.

### Comportamento por tipo

**Acoes (tarefas/pendencias):**
- Botoes de status rapido no topo do sheet: Pendente / Em Execucao / Concluida (tap para alternar, salva imediatamente)
- Campos editaveis: titulo, descricao, prazo, prioridade, tipo
- Botao "Salvar" para alteracoes nos campos de texto

**Propostas (oportunidades):**
- Exibicao dos dados da proposta (valor, produto, validade) em modo leitura
- Botoes de status rapido: Ativa / Aceita / Recusada (atualiza direto na tabela `crm_proposals`)

### Detalhes tecnicos

**1. Novo componente: `src/components/crm/EditarAcaoSheet.tsx`**
- Recebe a `UnifiedAction` selecionada como prop
- Usa o componente `Sheet` (lateral) do shadcn
- Para acoes (`_source === 'action'`):
  - Mutation de update na tabela `crm_actions` (campos: title, description, due_at, priority, type, status)
  - Botoes de status com feedback visual (cores iguais aos badges atuais)
- Para propostas (`_source === 'proposal'`):
  - Mutation de update na tabela `crm_proposals` (campo: status)
  - Campos de valor/validade em modo leitura
- Invalida queries `crm-actions-flat` e `crm-proposals-flat` ao salvar

**2. Alteracao: `src/pages/crm/CrmAcoes.tsx`**
- Adicionar estado `selectedAction: UnifiedAction | null`
- Tornar cada Card clicavel (`onClick` + `cursor-pointer`)
- Renderizar o `EditarAcaoSheet` passando a acao selecionada

**3. Alteracao: `src/hooks/useCrmAcoesData.ts`**
- Sem alteracoes no hook de dados -- a estrutura atual ja fornece tudo necessario

### Layout do Sheet

```text
+--------------------------------------+
|  [X]  Editar Acao                    |
+--------------------------------------+
|  Cliente: Fazenda XYZ (link)         |
|                                      |
|  STATUS:                             |
|  [Pendente] [Em Execucao] [Concluida]|
|                                      |
|  Titulo:   [________________]        |
|  Tipo:     [Tarefa v]                |
|  Prioridade: [P3 v]                  |
|  Prazo:    [dd/mm/aaaa]              |
|  Descricao: [______________]         |
|             [______________]         |
|                                      |
|        [Cancelar]  [Salvar]          |
+--------------------------------------+
```

### Arquivos envolvidos

| Arquivo | Acao |
|---------|------|
| `src/components/crm/EditarAcaoSheet.tsx` | Criar (novo) |
| `src/pages/crm/CrmAcoes.tsx` | Editar (click handler + sheet) |

