# Horímetro danificado na OS

Permitir marcar, na OS, que o horímetro do ativo está danificado. Nesse caso a leitura "Atual" fica 0 e o histórico de horas do ativo é preservado.

## Como vai funcionar

- No bloco "Horímetro" da OS aparece uma caixa de seleção "Horímetro danificado", ao lado do campo "Atual".
- Ao marcar: o campo "Atual" recebe 0, fica bloqueado para digitação e a validação de "não pode ser menor que a última leitura" deixa de bloquear a conclusão.
- Ao desmarcar: o campo volta a ficar editável e limpo, com as regras atuais.
- Ao concluir a OS com horímetro danificado:
  - a OS registra 0 como leitura, com a observação de que o horímetro estava danificado;
  - o ativo mantém a última leitura válida anterior (não é zerado);
  - se houver troca de motor nessa OS, as horas de uso do motor retirado ficam em branco (desconhecidas), com nota de horímetro danificado, e o marco de horas do motor no ativo não é alterado;
  - a análise de vida útil do motor no painel ignora ciclos sem horas conhecidas, como já faz hoje.
- Ao reabrir uma OS já registrada como horímetro danificado, a caixa aparece marcada e o valor 0 é exibido.
- Nas telas de leitura, uma OS com horímetro danificado mostra "Horímetro danificado" em vez de "0h", para não parecer erro de digitação.

## Detalhes técnicos

Banco (uma migration):
- `work_order_items.meter_damaged boolean NOT NULL DEFAULT false` — marca a OS cuja leitura foi feita com horímetro danificado.
- `asset_meter_readings.meter_damaged boolean NOT NULL DEFAULT false` — marca a leitura correspondente.
- `motor_replacement_history.motor_hours_used` passa a aceitar nulo, e nova coluna `motor_hours_unknown boolean NOT NULL DEFAULT false` para registrar ciclos sem horas confiáveis. Comentários explicativos nas colunas.
- Nenhuma policy de RLS alterada.

Frontend:
- `src/components/oficina/DetalheOSDialog.tsx`
  - novo estado `meterDamaged`; Checkbox no bloco Horímetro; `Input` de "Atual" com `value="0"` e `disabled` quando marcado.
  - validação de conclusão: com `meterDamaged`, pula a checagem de valor mínimo e de campo obrigatório.
  - `completeOSMutation`: grava `meter_hours_exit = 0` e `meter_damaged = true` no item; insere a leitura em `asset_meter_readings` com `meter_damaged = true`; **não** atualiza `workshop_items.meter_hours_last` nem `motor_replaced_at_meter_hours` quando danificado (evita o gatilho `validate_meter_hours` e preserva o histórico); no ramo de troca de motor grava histórico com `motor_hours_used = null` e `motor_hours_unknown = true`, sem gerar solicitação de garantia por horas.
  - sincronização ao reabrir a OS a partir de `meter_damaged` persistido.
- `src/components/oficina/MotorSection.tsx` e `src/components/oficina/SaudeAtivosMotores.tsx`: exibir "Horímetro danificado"/"Horas desconhecidas" onde hoje se mostraria 0h, e excluir esses registros das médias de vida útil.

## Fora do escopo

- Nenhuma alteração em outros módulos, permissões, tipos gerados ou Edge Functions.
- Nenhum recálculo de OS já concluídas.
