# DetalheOSDialog — conclusão de OS guiada pela peça de motor persistida

Arquivo: `src/components/oficina/DetalheOSDialog.tsx` (único arquivo tocado)

## Problema confirmado
`completeOSMutation` decide o branch "com troca de motor" por `isMotorReplacement` (estado local, linha ~910). O `useEffect` de reset em `[workOrder.id]` (linha ~281) zera esse estado a cada abertura do diálogo — inclusive reabertura da mesma OS. Resultado: peça de motor salva no banco + diálogo reaberto → OS concluída no branch "sem troca", sem `motor_replacement_history` nem atualização de `motor_replaced_at_meter_hours` / `current_motor_code`.

## Mudanças

1. **Fonte de verdade na conclusão** — em `completeOSMutation`:
   - Linha ~910: `if (isMotorReplacement)` → `if (motorPartInThisOS)` (valor derivado de `partsUsed`, criado no passo anterior).
   - Linha ~1059: `notes: isMotorReplacement ? 'Troca de motor realizada' : null` → usar `motorPartInThisOS`.
   - O bloco interno que busca `oldMotorCode`/`newMotorCode` re-varrendo `work_order_parts_used` (linhas ~925-958) permanece exatamente como está — já é acionado sempre que o branch de troca roda.

2. **Sincronização visual ao reabrir a OS** — novo `useEffect` dependente de `[motorPartInThisOS?.id, workOrder.id]`:
   - Quando `motorPartInThisOS` existe e `workOrder.status !== 'concluido'`:
     - `setIsMotorReplacement(true)` — o técnico reabra e vê a troca marcada.
     - `setMotorCodeInstalled(motorPartInThisOS.motor_code_installed ?? '')` e `setMotorCodeRemoved(motorPartInThisOS.motor_code_removed ?? '')` — campos de texto repopulados com o que está no banco.
     - `setMotorCodeConfirm(...)` pré-preenchido com `motor_code_installed ?? currentMotorCode`, para coerência visual (não afeta a gravação: com peça de motor presente, a conclusão usa o branch de troca).
   - Guard: só aplica quando há peça; o reset em `[workOrder.id]` continua limpando primeiro, e o efeito roda depois de `partsUsed` carregar (motorPartInThisOS passa de `null` → peça).

3. **Toggle travado quando a troca já está no banco** — enquanto `motorPartInThisOS` existir (OS não concluída), o clique no toggle "Troca de Motor" não desliga mais o estado (fica visualmente ON, pois os dados persistidos mandam). Sem peça salva, o toggle continua funcionando exatamente como hoje.

## Invariável (não muda)
- Fórmula de horas do motor (`meterValue - previousMilestone`) e fluxo de garantia (`warranty_requests`, threshold `garantia_motor_horas`).
- Horímetro de entrada não altera `workshop_items.meter_hours_last` fora do fluxo atual.
- Branch "sem troca" para OS sem peça de motor (critério de aceite 2) — `motorPartInThisOS` é `null` e tudo segue como antes.
- `MotorSection.tsx`, schema, migrations.

## Verificação
- Typecheck e build passam.
- Revisão de código dos 3 pontos acima; comportamento: adicionar peça de motor → fechar/reabrir a mesma OS → toggle aparece marcado e concluir grava histórico + marco de troca + código do motor novo igual ao fluxo sem fechar o diálogo.
