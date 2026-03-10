

## Alterar constraint de código único de ativo para ser único por produto

### Problema
Hoje o `unique_code` do `workshop_items` é globalmente único. O legado do cliente possui o mesmo código de ativo para produtos diferentes (ex: código "001" para uma pistola e "001" para uma válvula solenoide). A unicidade deve ser por tipo de produto (`omie_product_id`), não global.

### Alteração

**Migração SQL**
- Remover a constraint `UNIQUE` global em `unique_code`
- Criar uma constraint `UNIQUE(unique_code, omie_product_id)` — o par (código, produto) é único

```sql
ALTER TABLE public.workshop_items DROP CONSTRAINT workshop_items_unique_code_key;
ALTER TABLE public.workshop_items ADD CONSTRAINT workshop_items_unique_code_product UNIQUE (unique_code, omie_product_id);
```

**Frontend — `AssetSearchField.tsx`**
- Já filtra por `omie_product_id` na busca, então nenhuma mudança necessária. A criação de ativo já passa o `omie_product_id`, então o par será validado pelo banco.

**Nenhuma outra alteração de código é necessária** — as queries já filtram por produto.

