## Objetivo
Modificar o card de OS no `OSKanban` para exibir também a data de finalização (`end_time`) quando a OS estiver concluída.

## Mudança
No rodapé do card (linha ~160-174), substituir o bloco de data atual por:
- **Sempre** exibir: `Criado: dd/MM` (a partir de `created_at`)
- **Condicionalmente** exibir: `Finalizado: dd/MM` (a partir de `end_time`, apenas quando `end_time` não for null)

As duas datas ficarão no rodapé, lado a lado ou em linhas separadas, mantendo o estilo visual atual (`text-xs text-muted-foreground`).

## Arquivo afetado
- `src/components/oficina/OSKanban.tsx`

## Validação
- Verificar que OS concluídas exibem ambas as datas
- Verificar que OS não concluídas exibem apenas "Criado:"
- Build passa sem erros