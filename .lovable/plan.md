

## Simplificar Finalização de Visita (sem áudio obrigatório)

### Arquivo: `src/components/crm/FinalizarVisitaModal.tsx`

Reescrever o modal para ser um diálogo simples de confirmação:

1. **Remover**: Estado e UI de `summary`, `quickActions`, `newActionTitle`, funções `addAction`/`removeAction`
2. **Remover**: Validação `if (!summary.trim()) throw new Error(...)` 
3. **Remover**: Criação batch de `crm_actions` no mutationFn
4. **Adicionar**: Inputs de data (`type="date"`) e hora (`type="time"`) pré-preenchidos com momento atual, editáveis
5. **Manter**: Aviso de áudios pendentes (apenas informativo, sem bloquear)
6. **Manter**: Geolocalização no checkout e snapshot de produtos
7. **Mutation**: Usar data/hora dos inputs para calcular `checkout_at`; não enviar `summary`
8. **Botão**: Sempre habilitado (sem depender de summary), apenas desabilitado durante loading

### Arquivo: `src/pages/crm/CrmVisitaExecucao.tsx`

1. **Remover**: Card verde "Resumo da Visita" (linhas 237-248)
2. **Remover**: Exibição inline de `visit.summary` (linha 233)

### Resultado

Ao clicar "Finalizar", o consultor vê apenas: data/hora editáveis + aviso de áudios (se houver) + botão Confirmar. Sem campos obrigatórios.

