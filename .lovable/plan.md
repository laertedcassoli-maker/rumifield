

## Melhorar espaçamento entre blocos na OS

### O que muda

- Remover as 3 linhas divisórias (`<Separator />`) que foram adicionadas entre os blocos (Item/Motor, Motor/Peças, Peças/Observações).
- Aumentar o espaçamento do container principal de `space-y-8` (32px) para `space-y-10` (40px), criando mais respiro visual sem linhas.

### Detalhe técnico

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

1. Linha 839: trocar `space-y-8` por `space-y-10`
2. Linha 1058: remover `<Separator />`
3. Linha 1070: remover `<Separator />`
4. Linha 1152: remover `<Separator />`

