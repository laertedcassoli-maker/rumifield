# Correção: marco de uso do motor original

## Objetivo
Quando um ativo nunca teve troca de motor (`motor_replaced_at_meter_hours` nulo), o motor é o original — as horas de uso do motor retirado devem ser contadas desde zero, não desde a última leitura do horímetro.

Exemplo: última leitura 500h, primeira troca concluída com 878h → horas de uso do motor = **878h** (não 378h).

## Estado atual (confirmado)
Em `src/components/oficina/DetalheOSDialog.tsx`, linhas 921–923, dentro de `completeOSMutation`:

```ts
const previousMilestone = currentWorkshopItem?.motor_replaced_at_meter_hours ?? 
                          univocaItem.workshop_items?.meter_hours_last ?? 
                          0;
```

Quando não há marco de troca, o código usa a última leitura (`meter_hours_last`) como marco — exatamente a falha identificada na validação.

## Mudança
Apenas em `src/components/oficina/DetalheOSDialog.tsx`:

- Substituir o cálculo do marco anterior por: `motor_replaced_at_meter_hours ?? 0`.
- O fallback para `meter_hours_last` é removido. Motor sem marco de troca = motor original = marco 0.

Impactos diretos corretos dessa mudança:
- `motor_hours_used` gravado em `motor_replacement_history` passa a refletir a vida total do motor original.
- A verificação de garantia (`motorHoursUsed < warrantyHours`) passa a usar o valor correto, evitando abertura indevida de garantia.

## O que não muda
- Nenhum outro cálculo de horas ("Horas Motor"/"Horas Total" exibidos, `meter_hours_exit`, atualização de `meter_hours_last`).
- Ativos que já tiveram troca: continuam usando `motor_replaced_at_meter_hours` como marco (caminho inalterado).
- Nenhum outro arquivo, nenhuma migration, nenhuma mudança de UI.

## Validação
- `npx tsgo --noEmit -p tsconfig.app.json`.
- Revisão dos cenários: primeira troca com histórico de leituras (usa 0), primeira troca sem leituras (usa 0, igual a hoje), segunda troca em diante (usa o marco da troca anterior, inalterado).
