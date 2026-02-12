

## Criar Historico de Interacoes por Oportunidade (tela 360)

### Contexto
Cada registro em `crm_client_products` (produto x cliente) passa a ser chamado de **Oportunidade** na interface. A nova entidade registra interacoes (notas textuais) vinculadas a cada oportunidade.

### 1. Migracao SQL -- nova tabela `crm_opportunity_notes`

| Coluna | Tipo | Descricao |
|---|---|---|
| `id` | uuid PK | Identificador |
| `client_product_id` | uuid FK -> crm_client_products(id) ON DELETE CASCADE | Oportunidade |
| `user_id` | uuid (referencia profiles) | Autor da nota |
| `content` | text NOT NULL | Corpo da interacao |
| `created_at` | timestamptz DEFAULT now() | Data/hora |

Indice em `client_product_id`.

**RLS policies:**
- SELECT: admin/coordenador OU dono do cliente (`is_crm_client_owner`)
- INSERT: admin/coordenador OU dono do cliente
- DELETE: apenas admin/coordenador

### 2. Criar componente `OpportunityNotes`

Arquivo: `src/components/crm/OpportunityNotes.tsx`

- Recebe `clientProductId` e `clientId`
- Query propria (react-query) para buscar notas com join em `profiles` para nome do autor
- Lista em formato timeline compacta: avatar/iniciais + nome + data + texto
- Ordenacao: mais recentes primeiro
- Campo de texto inline + botao "Salvar" para adicionar nova nota
- Invalidar query ao salvar com sucesso

### 3. Integrar na tela 360

Arquivo: `src/pages/crm/CrmCliente360.tsx`

- Dentro de cada `ProductCard`, adicionar um `Collapsible` abaixo do card
- Trigger mostra contagem de notas (ex: "2 interacoes")
- Ao expandir, renderiza `OpportunityNotes` passando o `client_product_id`
- Alternativa: pode ficar como secao logo abaixo de cada ProductCard, sem collapsible, se preferir visual mais direto

### 4. Atualizar hook de dados

Arquivo: `src/hooks/useCrmData.ts` (funcao `useCliente360Data`)

- Adicionar query para buscar todas as notas do cliente (via join ou filtro nos `client_product_id` do cliente)
- Retornar contagem por oportunidade para exibir nos cards sem precisar expandir

### Nomenclatura na interface
- O titulo da secao de cada produto (hoje "Produtos") pode manter, pois cada card ja e uma oportunidade
- As interacoes aparecem como "Interacoes" ou "Historico" dentro de cada card
- O label do botao de adicionar: "Nova interacao"

### Arquivos a criar/modificar
- **Criar**: migracao SQL (tabela + RLS + indice)
- **Criar**: `src/components/crm/OpportunityNotes.tsx`
- **Modificar**: `src/pages/crm/CrmCliente360.tsx` (integrar notas nos cards)
- **Modificar**: `src/hooks/useCrmData.ts` (query de contagem de notas)
