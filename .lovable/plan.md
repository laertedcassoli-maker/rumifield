

## Fundo branco nos blocos da OS

### O que muda
Atualmente os blocos Item, Horimetro, Motor, Pecas e Observacoes usam `bg-muted/30` (cinza claro) ou nenhum fundo. O card Cronometro ja usa o componente `Card` que tem fundo branco (`bg-card`). A ideia e unificar todos para terem o mesmo fundo branco.

### Alteracoes

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

1. **Item** (linha 910): Adicionar `bg-card` ao `div` com classe `p-3 border rounded-lg`
2. **Horimetro** (linha 962): Trocar `bg-muted/30` por `bg-card`
3. **Pecas Utilizadas** (linha 1087): Trocar `bg-muted/30` por `bg-card`
4. **Observacoes (concluido)** (linha 1169): Trocar `bg-muted/30` por `bg-card`
5. **Observacoes (textarea)** (linha 1184): Envolver em div com `p-3 border rounded-lg bg-card` para manter consistencia

**Arquivo:** `src/components/oficina/MotorSection.tsx`

6. **MotorSection** (linha do container principal): Trocar `bg-muted/30` por `bg-card`

### Resultado
Todos os 6 blocos terao fundo branco uniforme com borda, igual ao card do Cronometro, criando uma interface mais limpa e consistente.

### Detalhes tecnicos
- Usa a variavel CSS `bg-card` que ja e definida pelo tema e funciona corretamente em dark mode
- Sao 6 trocas simples de classe CSS, sem mudanca de logica
