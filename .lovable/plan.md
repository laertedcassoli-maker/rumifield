

## Adicionar campo Família ao formulário de peças + preencher registros em branco

### Problema
O formulário de cadastro/edição de peças não possui o campo "Família". Além disso, peças com `familia` nula no banco precisam receber o valor padrão "RumiFlow".

### Mudanças

**1. Migration SQL** — Atualizar peças sem família:
```sql
UPDATE public.pecas SET familia = 'RumiFlow' WHERE familia IS NULL OR familia = '';
```

**2. Editar `src/pages/admin/Config.tsx`**:
- Adicionar `familia: string` ao `PecaFormData`
- Buscar famílias distintas existentes na query de peças para popular um `Select`
- Adicionar campo `Select` com as famílias existentes + opção de digitar nova família (combo select + input)
- Incluir `familia` no `createPeca` e `updatePeca` mutations
- Preencher `familia` ao abrir edição (`openEditPeca`)
- Default "RumiFlow" ao criar nova peça

O select listará dinamicamente as famílias já cadastradas no banco, e terá uma opção "Outra..." para digitar um valor customizado.

