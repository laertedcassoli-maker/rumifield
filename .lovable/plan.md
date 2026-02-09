

## Aumentar espaçamento entre blocos na OS concluída

Ajuste simples de espaçamento entre as seções (Peças Utilizadas, Observações, etc.) no diálogo de detalhe da OS.

### O que muda

- Aumentar o `gap` do container que agrupa os blocos de `space-y-4` (16px) para `space-y-6` (24px), dando mais "respiro" visual entre cada seção.
- Adicionar um `Separator` sutil entre os blocos principais para reforçar a divisão visual.

### Detalhe técnico

**Arquivo:** `src/components/oficina/DetalheOSDialog.tsx`

- Localizar o container que envolve os blocos de Peças Utilizadas, Observações e Conclusão na view de OS concluída.
- Trocar `space-y-4` por `space-y-6` nesse container.
- Opcionalmente inserir um componente `<Separator />` entre os blocos para separação adicional.

