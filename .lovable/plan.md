

## Melhorar Card de Cronometro - Tempo Total vs Sessao Atual

### Situacao atual
O card "Tempo Total" exibe um unico valor que mistura o total acumulado com o tempo da sessao corrente. O usuario precisa abrir o historico para ver o total real.

### Proposta
Redesenhar o card do cronometro para exibir **duas informacoes distintas**:

1. **Tempo da sessao atual** (destaque principal, fonte grande) - so aparece quando o cronometro esta rodando
2. **Tempo total acumulado** (informacao secundaria, sempre visivel) - soma de todas as sessoes historicas + sessao atual

### Layout proposto

```text
+------------------------------------------+
| Clock  Cronometro                        |
|                                          |
|   00:01:23          [Parar]              |
|   sessao atual                           |
|                                          |
|   Total acumulado: 00:04:51              |
+------------------------------------------+
```

Quando o cronometro **nao esta ativo**:

```text
+------------------------------------------+
| Clock  Cronometro                        |
|                                          |
|   Total: 00:03:28   [Iniciar]            |
|                                          |
+------------------------------------------+
```

### Detalhes tecnicos

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

1. **Renomear titulo** do card de "Tempo Total" para "Cronometro"

2. **Criar variavel `currentSessionTime`** que calcula apenas o tempo da sessao ativa:
   - Se `activeTimeEntry` existe: `Math.floor((Date.now() - started_at) / 1000)`
   - Se nao: `0`

3. **Manter `elapsedTime`** como total acumulado (ja funciona assim: `localTotalSeconds + runningTime`)

4. **Alterar o CardContent** para exibir:
   - Quando cronometro ativo: tempo da sessao atual em fonte grande + label "sessao atual" + linha com "Total acumulado: XX:XX:XX" usando `elapsedTime`
   - Quando parado: apenas "Total: XX:XX:XX" usando `elapsedTime` (que sera = `localTotalSeconds`)

5. **Ajustar o useEffect do timer** (linhas ~345-355):
   - Adicionar um novo state `currentSessionTime` com `useState(0)`
   - No interval, calcular ambos: `setElapsedTime(localTotalSeconds + runningTime)` e `setCurrentSessionTime(runningTime)`
   - Quando parado: `setCurrentSessionTime(0)`

### Resumo das alteracoes
- 1 arquivo: `src/components/oficina/DetalheOSDialog.tsx`
- Novo state: `currentSessionTime`
- Card redesenhado com duas linhas de informacao
- Zero impacto em logica de persistencia ou historico
