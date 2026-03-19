

## Plano: Validação rigorosa de peças por item com troca + badge visual "Peça pendente"

### Diagnóstico

A validação de peças vinculadas já existe em ambas as telas de finalização:
- `AtendimentoPreventivo.tsx` (linhas 422-517) — preventivas
- `ExecucaoVisitaCorretiva.tsx` (linhas 598-690) — corretivas

Porém há problemas:

1. **Bug de erro duplicado em `AtendimentoPreventivo.tsx`**: Linhas 509-513 adicionam o MESMO erro uma segunda vez fora do bloco `if (stillMissing > 0)`, causando falsos positivos (bloqueia mesmo quando peças manuais cobrem os itens).

2. **Sem indicação visual no checklist**: O técnico não sabe quais itens específicos precisam de peça — apenas vê o erro genérico ao tentar finalizar.

3. **Não há badge "Peça pendente"** nos itens do checklist com "troca de peça" que ainda não têm peça vinculada.

### Alterações

**1. Corrigir bug em `AtendimentoPreventivo.tsx`**
- Remover o bloco duplicado nas linhas 509-513 que empurra o erro sem checar `stillMissing`.

**2. Adicionar badge "Peça pendente" em `ChecklistExecution.tsx`**
- Buscar dados de `preventive_part_consumption` para saber quais `exec_item_id` já têm peças vinculadas.
- Para cada item com `status = 'N'` e ação de "troca" selecionada, verificar se existe pelo menos 1 peça linkada.
- Exibir badge `Peça pendente` (âmbar/laranja, com ícone Package) ao lado do nome do item quando faltar peça.
- Usar uma query adicional leve: `select exec_item_id from preventive_part_consumption where preventive_id = ?` (já existe uma query similar de consumed parts).

**3. Garantir consistência da validação na corretiva (`ExecucaoVisitaCorretiva.tsx`)**
- A lógica já está correta neste arquivo (sem duplicação). Nenhuma alteração necessária.

### Arquivos alterados
- `src/pages/preventivas/AtendimentoPreventivo.tsx` — remover linhas 509-513 (bug)
- `src/components/preventivas/ChecklistExecution.tsx` — adicionar query de peças vinculadas + badge "Peça pendente" nos itens sem cobertura

### Resultado
- Técnico vê em tempo real quais itens do checklist estão sem peça
- Finalização bloqueada corretamente (sem falsos positivos)
- Mensagem de erro clara e consistente em ambas as telas

