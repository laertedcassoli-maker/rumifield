
# Tela Admin: Métricas de Saúde por Cliente

## Objetivo
Criar uma nova tela dentro do menu Administracao que exiba uma tabela flat com todos os clientes e seus valores de metricas de saude, organizados por produto. O admin podera visualizar rapidamente a saude de toda a base de clientes.

## Layout da Tela

A tabela tera o seguinte formato:

```text
+----------------+----------+--------+--------+-----------+--------+-----------+
| Cliente        | Fazenda  | Prod.  | Saude  | Motivos   | Ultimo | Metricas  |
|                |          |        |        |           | Snap   | (dinamico)|
+----------------+----------+--------+--------+-----------+--------+-----------+
| Fazenda Silva  | Sta Rosa | Ideagri| Verde  | —         | 05/02  | CCS: 250  |
| Fazenda Silva  | Sta Rosa | OnFarm | Verm.  | CCS alto  | 05/02  | CBT: 800  |
| Fazenda Lima   | Boa Vist | Ideagri| Amar.  | Atraso pg | 04/02  | ...       |
+----------------+----------+--------+--------+-----------+--------+-----------+
```

## Funcionalidades
- Filtro por produto (todos / produto especifico)
- Filtro por status de saude (todos / verde / amarelo / vermelho)
- Busca por nome de cliente ou fazenda
- Exibicao dinamica das colunas de metricas baseada nas `crm_metric_definitions` ativas
- Indicador visual de saude com cores (verde/amarelo/vermelho)
- Exibicao dos motivos de saude
- Link para o Cliente 360 ao clicar no nome
- Mensagem informativa quando nao houver dados de snapshots ainda

## Detalhes Tecnicos

### 1. Nova pagina: `src/pages/admin/CrmMetricas.tsx`
- Busca dados de `crm_client_product_snapshots` com join em `clientes` para nome/fazenda
- Busca `crm_metric_definitions` ativas para montar colunas dinamicas
- Extrai valores do campo JSONB `data` de cada snapshot
- Filtros: produto, saude, busca textual
- Tabela usando componentes `Table` existentes

### 2. Rota no `App.tsx`
- Adicionar rota `/admin/crm/metricas` com layout `AppLayout`

### 3. Link no menu ou na pagina CrmConfig
- Adicionar um botao/link na pagina `/admin/crm` que leva para `/admin/crm/metricas`
- Ou adicionar como uma aba/secao na propria pagina de Config CRM

### Queries principais
```typescript
// Snapshots com dados do cliente
supabase.from('crm_client_product_snapshots')
  .select('*, clientes!inner(nome, fazenda, cidade, estado)')
  .order('snapshot_at', { ascending: false })

// Metric definitions para colunas dinamicas
supabase.from('crm_metric_definitions')
  .select('*')
  .eq('is_active', true)
  .order('priority')
```

### Estado vazio
Como os snapshots ainda nao tem dados (serao populados pela integracao iMilk), a tela exibira uma mensagem clara: "Nenhum dado de saude disponivel. Os dados serao populados automaticamente pela integracao iMilk."
