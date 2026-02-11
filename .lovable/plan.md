

## Melhorias no Sistema de Solicitacao de Pecas

### Contexto

Atualmente o sistema de pedidos (solicitacoes) e uma lista/tabela simples com status lineares. O usuario quer:

1. Pedidos de origem "tecnico" gerarem solicitacao apenas para emissao de NF (sem envio fisico)
2. Novos campos de metadados nos pedidos
3. Campo de urgencia nos modais de criacao
4. Novo layout Kanban com 3 colunas

---

### 1. Alteracoes no Banco de Dados

Adicionar colunas na tabela `pedidos`:

| Coluna | Tipo | Descricao |
|---|---|---|
| `origem` | text, nullable | Origem do pedido: `manual`, `preventiva`, `corretiva`, `chamado` |
| `tipo_envio` | text, nullable | Tipo de envio: `correio`, `entrega`, `apenas_nf` |
| `urgencia` | text, default `'normal'` | Grau de urgencia: `baixa`, `normal`, `alta`, `critica` |

Os campos `solicitante_id` (usuario que criou) e `cliente_id` (de onde se extrai o `consultor_rplus_id`) ja existem, nao precisam de novas colunas.

O enum `pedido_status` atual tem: `rascunho`, `solicitado`, `processamento`, `faturado`, `enviado`, `entregue`. Para o Kanban simplificado de 3 colunas, vamos mapear:
- **Aberto** = `solicitado`
- **Em Processamento** = `processamento`
- **Concluido** = `faturado` (quando o financeiro registra a NF)

Nao precisa alterar o enum, apenas a UI agrupa os status existentes.

---

### 2. Preencher Origem Automaticamente

Nos locais onde pedidos sao criados automaticamente, preencher o campo `origem`:

- `src/pages/preventivas/AtendimentoPreventivo.tsx` (completeMutation): `origem: 'preventiva'`, e para pecas de origem "tecnico" usar `tipo_envio: 'apenas_nf'`
- `src/components/chamados/TicketPartsRequestPanel.tsx`: `origem: 'chamado'`
- `src/pages/Pedidos.tsx` (criacao manual): `origem: 'manual'`

---

### 3. Campo de Urgencia nos Modais de Criacao

Adicionar seletor de urgencia (ToggleGroup com 4 opcoes) em:

- `src/pages/Pedidos.tsx` -- no formulario de novo pedido
- `src/components/chamados/TicketPartsRequestPanel.tsx` -- no painel lateral de chamados
- Formularios futuros de criacao

Opcoes visuais:
- Baixa (cinza)
- Normal (azul, default)
- Alta (laranja)
- Critica (vermelho)

---

### 4. Campo Tipo de Envio nos Modais

Adicionar seletor de tipo de envio:
- Correio (icone de caminhao)
- Entrega (icone de pacote/mao)
- Apenas NF (icone de nota fiscal) -- pre-selecionado quando origem e "tecnico" em preventivas

---

### 5. Nova Pagina Kanban de Solicitacoes

Substituir a view atual de tabela/cards na aba "Transmitidos" por um **Kanban de 3 colunas**:

```text
+------------------+------------------+------------------+
|     ABERTO       | EM PROCESSAMENTO |    CONCLUIDO     |
|   (solicitado)   |  (processamento) |    (faturado)    |
|                  |                  |                  |
|  [Card pedido]   |  [Card pedido]   |  [Card pedido]   |
|  [Card pedido]   |                  |  [Card pedido]   |
+------------------+------------------+------------------+
```

Cada card exibe:
- Cliente / Fazenda
- Badge de urgencia (cor)
- Badge de origem (preventiva/chamado/manual)
- Tipo de envio (icone)
- Consultor R+ do cliente
- Solicitante
- Data de criacao
- Quantidade de pecas
- Botao "Ver detalhes"

**Acoes por coluna:**
- Aberto: botao "Processar" para mover para "Em Processamento"
- Em Processamento: botao "Concluir" que abre dialog para registrar numero da NF
- Concluido: apenas visualizacao

A aba "Rascunhos" permanece como esta (lista com botoes de transmitir).

---

### 6. Dialog de Conclusao (Registro de NF)

Ao clicar "Concluir" em um pedido "Em Processamento":
- Abre dialog solicitando o numero da NF (`omie_nf_numero`)
- Data de faturamento (default: hoje)
- Ao confirmar: atualiza status para `faturado`, grava `omie_nf_numero` e `omie_data_faturamento`

---

### 7. Exibir Consultor R+ do Cliente

Na listagem/Kanban, buscar `consultor_rplus_id` do cliente e exibir o nome do consultor. Isso requer um join adicional na query:
- `pedidos -> clientes -> profiles (via consultor_rplus_id)`

---

### Detalhes Tecnicos

**Migracao SQL:**
```sql
ALTER TABLE pedidos ADD COLUMN origem text;
ALTER TABLE pedidos ADD COLUMN tipo_envio text;
ALTER TABLE pedidos ADD COLUMN urgencia text NOT NULL DEFAULT 'normal';
```

**Arquivos modificados:**

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | 3 novas colunas |
| `src/pages/Pedidos.tsx` | Kanban na aba Transmitidos, campos urgencia/tipo_envio no form, dialog de NF, exibir origem/consultor |
| `src/hooks/useOfflinePedidos.ts` | Incluir novos campos no createPedido e syncFromServer |
| `src/lib/offline-db.ts` | Atualizar interface OfflinePedido com novos campos |
| `src/components/chamados/TicketPartsRequestPanel.tsx` | Campos urgencia e tipo_envio, preencher origem='chamado' |
| `src/pages/preventivas/AtendimentoPreventivo.tsx` | Preencher origem='preventiva' e tipo_envio='apenas_nf' para pecas de tecnico |

**RLS:** Nenhuma alteracao necessaria -- as policies existentes de pedidos ja cobrem os novos campos (sao colunas da mesma tabela).

