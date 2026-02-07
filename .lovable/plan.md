

## Incluir Propostas como "Oportunidades" na tela de Acoes CRM

### O que muda para o usuario
Ao selecionar o filtro "Oportunidade", a tela passara a listar as propostas comerciais (`crm_proposals`) como cards, com visual adaptado mostrando produto, valor proposto, validade e status da proposta. O link do cliente continua levando ao 360.

### Como funciona

A query atual busca apenas `crm_actions`. A mudanca adiciona uma segunda query em `crm_proposals` (com join em `crm_client_products` e `clientes`) e unifica os resultados em uma lista so, normalizando os campos para um formato comum.

### Detalhes tecnicos

#### Alteracoes em `src/pages/crm/CrmAcoes.tsx`

1. **Nova query para propostas**: buscar `crm_proposals` com join em `crm_client_products` (para `product_code` e `client_id`) e `clientes` (para `nome`). Para consultores, filtrar por `crm_client_products.owner_user_id`.

2. **Normalizar propostas para o mesmo formato de "acao"**:
   - `title` -> "Proposta {PRODUCT_LABELS[product_code]}" (ex: "Proposta RumiFlow")
   - `type` -> `'oportunidade'`
   - `status` -> mapear: `ativa` -> `aberta`, `aceita` -> `concluida`, `recusada`/`expirada` -> `concluida`
   - `due_at` -> `valid_until` da proposta
   - `priority` -> 2 (media, padrao)
   - `description` -> `notes` da proposta
   - `clientes` -> vem do join

3. **Unificar as duas listas** (`actions` + `propostas normalizadas`) no `useMemo` de filtragem, antes de aplicar filtros e ordenacao.

4. **Ajustar o card para propostas**: quando o item for uma proposta, mostrar o valor proposto (`proposed_value`) formatado como moeda, e um badge de status especifico da proposta (Ativa, Aceita, Recusada, Expirada) em vez do badge generico de acao.

5. **Adicionar campo `_source`** aos itens normalizados (`'action'` ou `'proposal'`) para distinguir no render.

#### Nenhuma alteracao no banco de dados
Usa tabelas e RLS ja existentes (`crm_proposals`, `crm_client_products`, `clientes`).

#### Resumo de mudancas

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/crm/CrmAcoes.tsx` | Adicionar query de propostas, normalizar e unificar com acoes, adaptar cards |

