

## Ajustes no fluxo de conclusao de OS - Motor e Troca automatica

### Resumo das 3 mudancas

1. **Campo "N Motor Atual" condicional**: so exibir quando o item NAO tem motor cadastrado (`current_motor_code` vazio/null). Se ja tem motor, pular esse campo e sua validacao.

2. **Ativar "Troca de Motor" automaticamente**: quando uma peca de motor for adicionada nas pecas utilizadas, ativar `isMotorReplacement = true` e pre-preencher o codigo do motor instalado.

3. **Manter logica de conclusao coerente**: na mutation de conclusao, so atualizar `current_motor_code` via `motorCodeConfirm` quando o campo foi exibido (motor nao existia).

---

### Detalhes tecnicos

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

#### Mudanca 1 - Campo "N Motor Atual" condicional (linhas 988-1013)

- Adicionar condicao: so exibir o bloco do campo `motorCodeConfirm` se `!currentMotorCode` (motor nao cadastrado)
- De: `{workOrder.status !== 'concluido' && univocaItem?.workshop_item_id && (`
- Para: `{workOrder.status !== 'concluido' && univocaItem?.workshop_item_id && !currentMotorCode && (`

#### Mudanca 2 - Validacao condicional (linhas 1161-1178)

- Envolver a validacao de `motorCodeConfirm` com `if (!currentMotorCode)` para so validar quando o campo esta visivel
- De:
```
if (requiresMeterHours && univocaItem?.workshop_item_id) {
  const codePattern = ...
  if (!motorCodeConfirm.trim()) { ... }
  if (!codePattern.test(...)) { ... }
}
```
- Para:
```
if (requiresMeterHours && univocaItem?.workshop_item_id && !currentMotorCode) {
  // mesma validacao
}
```

#### Mudanca 3 - Ativar troca automaticamente (linhas 530-545)

- No `onSuccess` da `addPartMutation`, apos o toast, adicionar:
```typescript
if (result?.isMotorPart) {
  setIsMotorReplacement(true);
  if (result.motorCodeInstalled) {
    setMotorCodeInstalled(result.motorCodeInstalled);
  }
}
```
- Isso garante que ao adicionar uma peca de motor, a flag de troca e ativada automaticamente e o campo "Motor Instalado" na secao de conclusao ja vem preenchido.

#### Mudanca 4 - Logica de conclusao sem troca (linhas 717-724)

- No bloco que atualiza `current_motor_code` sem troca de motor, manter como esta -- o `if (motorCodeConfirm.trim())` ja protege contra gravar vazio quando o campo nao foi exibido.

### Resultado esperado

- Item **com** motor cadastrado: campo "N Motor Atual" nao aparece, sem validacao extra. Usuario so precisa informar horimetro.
- Item **sem** motor cadastrado: campo "N Motor Atual" aparece obrigatorio (comportamento atual).
- Ao adicionar peca de motor: "Troca de Motor" e ativada automaticamente.

