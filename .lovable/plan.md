

## Adicionar flag "Controle de Ativo" no Catalogo de Pecas

### Objetivo

Nem toda peca trocada precisa de controle de ativo (codigo univoco). Adicionar um campo booleano `is_asset` na tabela `pecas` para marcar quais pecas sao controladas como ativo. No fluxo de consumo (preventiva/corretiva), o campo "Cod. Univoco do Ativo" so aparece se a peca estiver marcada como ativo E a origem for "tecnico".

---

### Alteracoes no Banco de Dados

Adicionar coluna na tabela `pecas`:

```text
is_asset | boolean | NOT NULL | DEFAULT false
```

---

### Alteracoes em `src/pages/admin/Config.tsx`

1. Adicionar `is_asset: boolean` na interface `PecaFormData` (default `false`)
2. No formulario de criacao/edicao de peca (Dialog), adicionar um `Switch` com label "Controle de ativo" e descricao "Exige codigo univoco ao registrar troca com estoque do tecnico"
3. Incluir `is_asset` nas mutations `createPeca` e `updatePeca`
4. Exibir badge "Ativo" na tabela de listagem para pecas com `is_asset = true`

---

### Alteracoes em `src/components/preventivas/ConsumedPartsBlock.tsx`

1. Incluir `is_asset` no tipo `ConsumedPart` (vindo de um join com `pecas` ou snapshot no registro)
2. Buscar `is_asset` da peca ao carregar os itens consumidos (join com `pecas` via `part_id`)
3. Condicionar a exibicao do `AssetCodeInput` e do dialog de codigo univoco:
   - Exibir **apenas** quando `stock_source === 'tecnico'` **E** a peca tem `is_asset === true`
4. No dialog "Adicionar Peca Manual", condicionar o campo de codigo univoco da mesma forma

---

### Alteracoes em `src/pages/preventivas/AtendimentoPreventivo.tsx`

Na logica de encerramento (`completeMutation`), ao criar ativos em `workshop_items`:
- Filtrar apenas pecas que tem `is_asset = true` (buscar da tabela `pecas`) alem de ter `asset_unique_code` preenchido

---

### Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar `is_asset boolean NOT NULL DEFAULT false` em `pecas` |
| `src/pages/admin/Config.tsx` | Switch no form, badge na listagem, mutations |
| `src/components/preventivas/ConsumedPartsBlock.tsx` | Condicionar campo de codigo univoco a `is_asset` |
| `src/pages/preventivas/AtendimentoPreventivo.tsx` | Filtrar criacao de ativo por `is_asset` |
