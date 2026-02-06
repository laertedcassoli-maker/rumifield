

# Auto-criar registros de produtos na Config. CRM

## Problema atual
Apenas o RumiFlow existe na tabela `produtos`. Os outros 4 produtos (Ideagri, OnFarm, RumiAction, Insights) nao mostram a secao de edicao (nome + cod_imilk) porque nao tem registro correspondente.

## Solucao
Ao carregar a pagina de Config. CRM, verificar quais produtos do `PRODUCT_ORDER` ainda nao existem na tabela `produtos` e cria-los automaticamente (com o nome do `PRODUCT_LABELS`). Assim todos os 5 cards sempre mostram a secao de edicao.

## Detalhes tecnicos

### Alteracoes em `src/pages/admin/CrmConfig.tsx`

1. **Trocar o match por nome** por um match mais robusto: adicionar uma coluna `product_code` na tabela `produtos` para vincular diretamente ao enum do CRM, eliminando a dependencia de comparar nomes.

2. **Auto-provisioning**: Apos carregar os produtos, executar um `upsert` para os codigos faltantes:
   - Para cada `ProductCode` em `PRODUCT_ORDER`, verificar se ja existe um registro com aquele `product_code`
   - Se nao existir, inserir com `nome = PRODUCT_LABELS[code]` e `product_code = code`
   - Invalidar a query de produtos apos a insercao

3. **Atualizar `getProductRecord`** para buscar por `product_code` em vez de comparar `nome.toLowerCase()`.

### Migracao de banco de dados

```sql
-- Adicionar coluna product_code na tabela produtos
ALTER TABLE public.produtos ADD COLUMN product_code text;

-- Atualizar o registro existente do RumiFlow
UPDATE public.produtos SET product_code = 'rumiflow' WHERE nome = 'RumiFlow';

-- Criar indice unico para evitar duplicatas
CREATE UNIQUE INDEX idx_produtos_product_code ON public.produtos(product_code) WHERE product_code IS NOT NULL;
```

### Logica de auto-criacao (no componente)

Apos o fetch dos produtos, um `useEffect` verifica os codigos faltantes e insere automaticamente:

```typescript
useEffect(() => {
  if (!produtosComerciais || loadingProdutos) return;
  const existingCodes = new Set(produtosComerciais.map(p => p.product_code));
  const missing = PRODUCT_ORDER.filter(code => !existingCodes.has(code));
  if (missing.length > 0) {
    const inserts = missing.map(code => ({
      nome: PRODUCT_LABELS[code],
      product_code: code,
    }));
    supabase.from('produtos').insert(inserts).then(() => {
      queryClient.invalidateQueries({ queryKey: ['produtos-comerciais-crm'] });
    });
  }
}, [produtosComerciais, loadingProdutos]);
```

### Resultado
- Todos os 5 produtos sempre visíveis com secao de edicao (nome + cod_imilk)
- Nenhuma outra tela necessaria para cadastro de produtos
- Vinculo direto via `product_code` em vez de comparacao por nome

