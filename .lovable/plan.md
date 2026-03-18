

## Adicionar confirmação de exclusão de peças no ConsumedPartsBlock

### Problema
A exclusão de peças acontece imediatamente ao clicar na lixeira, sem confirmação. Isso pode causar remoções acidentais em campo.

### Solução

**Arquivo: `src/components/preventivas/ConsumedPartsBlock.tsx`**

1. **Adicionar estado para controlar o AlertDialog** no componente `ConsumedPartsBlock`:
   - `deleteConfirmPartId: string | null` — armazena o ID da peça pendente de confirmação

2. **Alterar o `onDelete` passado ao `PartItem`** para apenas setar o `deleteConfirmPartId` em vez de chamar a mutation diretamente

3. **Adicionar um `AlertDialog` no JSX do `ConsumedPartsBlock`** (após o Card), usando os componentes já importados no projeto (`AlertDialog`, `AlertDialogContent`, etc.):
   - Titulo: "Confirmar exclusão"
   - Mensagem: "Você realmente deseja excluir esta peça?" com nome/código da peça
   - Botao Cancelar (outline)
   - Botao Excluir (destructive) — chama `deleteManualPartMutation.mutate(deleteConfirmPartId)`

4. **Imports**: Adicionar imports de `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` de `@/components/ui/alert-dialog`

Nenhuma alteração no banco, na lógica do checklist ou no layout existente. Apenas a interposição do modal de confirmação antes da exclusão.

