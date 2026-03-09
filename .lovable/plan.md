

## Problema

O campo "Nº Motor Atual" (`motorCodeConfirm`) é um campo local que só é salvo no banco quando a OS é **concluída**. Antes disso, `current_motor_code` no banco continua `null`.

Quando o usuário clica "Adicionar Peça" e seleciona um motor, o código pré-preenchido em "Motor Retirado" vem de `currentMotorCode` (linha 329), que lê do banco via `workshop_items.current_motor_code`. Como o valor ainda não foi persistido, vem vazio.

## Correção

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

Na linha 337, ao pré-preencher "Motor Retirado", usar também o valor digitado localmente (`motorCodeConfirm`) como fallback:

```typescript
// Linha 329 - adicionar fallback para o valor local
const currentMotorCode = univocaItemForMotor?.workshop_items?.current_motor_code || '';

// Linha 337 - usar motorCodeConfirm como fallback
const effectiveMotorCode = currentMotorCode || motorCodeConfirm;
if (peca.nome?.toLowerCase().includes('motor') && effectiveMotorCode) {
  setMotorCodeRemoved(effectiveMotorCode);
}
```

Também atualizar a referência em `!currentMotorCode` nas demais validações para manter consistência (linhas 1022, 1041, 1204) — essas já estão corretas pois controlam a exibição do campo de input, que só aparece quando não há valor no banco.

**Escopo:** ~3 linhas alteradas em 1 arquivo.

