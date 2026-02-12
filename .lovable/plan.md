

## Adicionar colunas de auditoria na tabela de Ativos

### O que muda
A tabela `workshop_items` ganhara duas novas colunas (`created_by_user_id` e `creation_source`) e a tela de Ativos exibira essas informacoes junto com a data/hora de criacao que ja existe.

### Alteracoes no banco de dados (migracao SQL)

Adicionar duas colunas a tabela `workshop_items`:
- `created_by_user_id` (uuid, nullable) -- referencia ao usuario que criou
- `creation_source` (text, default `'manual'`) -- valores: `manual` ou `automatico`

Os registros existentes ficam com `created_by_user_id = null` e `creation_source = 'manual'`.

### Alteracoes no codigo

**`src/pages/oficina/ItensOficina.tsx`**

1. Atualizar a query de SELECT para incluir join com `profiles` via `created_by_user_id`:
   ```
   pecas:omie_product_id (...),
   created_by:created_by_user_id (id, nome)
   ```
2. Adicionar 3 novas colunas na tabela:
   - **Criado em**: formata `created_at` com `dd/MM/yyyy HH:mm`
   - **Criado por**: nome do usuario (ou "-" se null)
   - **Origem**: badge "Manual" ou "Automatico"
3. No formulario de criacao (INSERT), enviar `created_by_user_id: userId` e `creation_source: 'manual'`
4. Atualizar a interface `WorkshopItem` com os novos campos

**`src/components/pedidos/AssetSearchField.tsx`**

1. No INSERT de criacao rapida pelo campo de busca, incluir `created_by_user_id: userId` e `creation_source: 'automatico'` (ja que e criacao inline a partir do pedido)

### Detalhes tecnicos

- A coluna `created_at` ja existe com default `now()`, entao basta exibi-la
- `created_by_user_id` e nullable para nao quebrar registros antigos
- `creation_source` tem default `'manual'` para registros antigos
- O `userId` vem do hook `useAuth()` que ja esta importado em ambos os arquivos

