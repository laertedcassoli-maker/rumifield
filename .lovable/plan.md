# DetalheOSDialog — preparar fonte de dados `motorPartInThisOS`

Arquivo: `src/components/oficina/DetalheOSDialog.tsx` (único arquivo tocado)

## Objetivo
Criar um valor derivado memoizado `motorPartInThisOS` que identifica, nos dados já persistidos da OS atual (`partsUsed`, vindo de `work_order_parts_used`), se há uma peça de motor e expõe seus códigos `motor_code_removed` / `motor_code_installed`. Nenhum comportamento visível muda neste passo — é apenas a fonte de dados para os próximos passos.

## Mudanças

1. **Import**: adicionar `useMemo` ao import de `react` (linha 1: `useState, useEffect, useRef` → `+ useMemo`).

2. **Interface `PartUsed`** (linha ~82): adicionar campos opcionais, que hoje já são gravados no banco (linhas 792/795) e voltam no `select('*')`, mas não estão tipados:
   ```ts
   motor_code_removed?: string | null;
   motor_code_installed?: string | null;
   ```

3. **Valor derivado** — logo abaixo de `hasMotorPart` (linha ~1119), substituindo sua implementação para reutilizar a mesma lógica (mesma regra de nome: `part.pecas?.nome?.toLowerCase().includes('motor')`):
   ```ts
   const motorPartInThisOS = useMemo(
     () => partsUsed.find(part => part.pecas?.nome?.toLowerCase().includes('motor')) ?? null,
     [partsUsed]
   );
   ```
   - `motorPartInThisOS` = a peça de motor persistida da OS atual, ou `null` se não houver.
   - `motorPartInThisOS?.motor_code_removed` / `?.motor_code_installed` expõem os códigos quando existirem.

4. **`hasMotorPart`** passa a ser `motorPartInThisOS !== null` (ou equivalente via `Boolean(motorPartInThisOS)`), preservando o comportamento atual do único uso existente (indicador visual da linha ~1596). Nada mais no arquivo muda.

## O que NÃO é alterado
- `completeOSMutation`, `addPartMutation`, `removePartMutation`, o `useEffect` de reset em `[workOrder.id]`.
- `motor_replacement_history`, `workshop_items`, qualquer escrita.
- Nenhuma UI, texto ou comportamento visível.

## Verificação
- Build/tipocheck passam (typecheck automático do projeto).
- Confirmação por revisão de código de que `motorPartInThisOS` reflete a peça de motor salva no banco quando ela existe (sem `console.log` temporário no entregável).
