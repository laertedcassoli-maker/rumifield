

## Permitir vincular cliente inativo à OS

**Problema:** A query de clientes no `NovaOSDialog.tsx` (linha 112) filtra `.eq('status', 'ativo')`, impedindo que clientes inativos apareçam.

**Solução:** Remover o filtro de status e adicionar um badge visual "(inativo)" para distinguir clientes inativos na busca.

**Arquivo:** `src/components/oficina/NovaOSDialog.tsx`

1. Remover `.eq('status', 'ativo')` da query de clientes (linha 112)
2. Adicionar campo `status` ao select (linha 111)
3. Exibir badge "(inativo)" ao lado do nome do cliente nos resultados de busca e no card selecionado

