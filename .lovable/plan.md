
## Simplificar modal de finalização — somente leitura + confirmação

### O que muda

O modal de finalizar visita deixará de ter campos editáveis de data e hora. Em vez disso, exibirá as informações de término e duração como **somente leitura** e pedirá confirmação do encerramento.

### Layout do modal

```text
+-----------------------------------+
|       Finalizar Visita            |
+-----------------------------------+
|                                   |
|  Deseja encerrar esta visita?     |
|                                   |
|  +-----------------------------+  |
|  | Check-in:  12/02 09:30      |  |
|  | Término:   12/02 11:45      |  |
|  | Duração:   2h 15min         |  |
|  +-----------------------------+  |
|                                   |
|  [aviso áudios pendentes]         |
|                                   |
|       [Cancelar]  [Confirmar]     |
+-----------------------------------+
```

### Mudanças técnicas

**Arquivo:** `src/components/crm/FinalizarVisitaModal.tsx`

1. **Remover** os states `checkoutDate` e `checkoutTime` (linhas 38-39)
2. **Remover** a variável `checkoutAt` derivada (linha 61)
3. **Remover** imports de `Input`, `Label`, `useState` (não mais necessários)
4. **Remover** o grid com inputs de data e hora (linhas 128-137)
5. **Adicionar** texto de confirmação: "Deseja encerrar esta visita?"
6. **Reformular** o card informativo para mostrar 3 linhas:
   - Check-in: data/hora do check-in
   - Término: `now` (horário atual, atualizado ao abrir o modal)
   - Duração: diferença entre check-in e agora
7. **Na mutation** (linha 77): trocar `checkoutAt.toISOString()` por `new Date().toISOString()` — o horário real do clique é registrado
8. O cálculo de duração exibido usa `new Date()` capturado ao abrir o modal (variável `now` já existente na linha 37), apenas para dar uma estimativa visual ao usuário
