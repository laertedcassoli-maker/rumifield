# DetalheOSDialog — resincronizar estado de troca de motor ao remover a peça

Arquivo: `src/components/oficina/DetalheOSDialog.tsx` (único arquivo tocado)

## Diagnóstico
- `removePartMutation` (linha ~835) só deleta e invalida `['parts-used', workOrder.id]`; `motorPartInThisOS` vira `null` no refetch e a conclusão **já** cai no branch "sem troca" (passo anterior) — o dado fica correto.
- O que fica errado é o estado de UI: `isMotorReplacement` continua `true`, e `motorCodeRemoved`/`motorCodeInstalled`/`motorCodeConfirm` permanecem preenchidos. Pior: `motorCodeConfirm` foi pré-preenchido com o código do motor removido, e no branch "sem troca" a conclusão grava `current_motor_code = motorCodeConfirm` se não estiver vazio — gravaria o código de um motor que não foi instalado.

## Mudanças

1. **Estender o `useEffect` de sincronização existente** (o que reflete `motorPartInThisOS` ao reabrir a OS), tratando também o caso `null`:
   - Quando `motorPartInThisOS` existe e OS não concluída: comportamento atual mantido (toggle ON, códigos repopulados).
   - Quando `motorPartInThisOS` é `null` e OS não concluída: `setIsMotorReplacement(false)` e limpar `motorCodeRemoved`, `motorCodeInstalled` e `motorCodeConfirm` — volta ao estado "sem troca" após remover a peça de motor.
   - Dependências atuais (`[motorPartInThisOS?.id, workOrder.id, workOrder.status]`) já cobrem: remover a última peça de motor muda `motorPartInThisOS?.id` de `<id>` → `undefined`.

2. Nenhuma mudança em `removePartMutation` nem em `completeOSMutation` — o aceite de conclusão "sem troca" já é garantido pela fonte de verdade `motorPartInThisOS` (implementada no passo anterior).

## Invariável
- Remoção de peças não relacionadas a motor: `motorPartInThisOS` não muda (mesmo id), o efeito não roda de novo e nada é resetado.
- Lógica de remoção, fórmulas de horas, fluxo de garantia, `MotorSection.tsx`, schema.

## Verificação
- Typecheck passa.
- Revisão: adicionar peça de motor → remover → `motorPartInThisOS` vira `null`, toggle desmarca, campos limpam → concluir grava `current_motor_code` apenas com o que o técnico informar no campo de confirmação (ou nada), sem `motor_replacement_history` nem `motor_replaced_at_meter_hours`.
