

## Revisao e Correcao do Menu de Permissoes

### Problemas identificados

1. **Bug: `crm_clientes` com grupo "Principal" (P maiusculo)** - deveria ser "principal" (minusculo). Isso impede que o item apareca corretamente na tela de Permissoes dentro do grupo "Menu Principal".

2. **Registro orfao: `visitas`** - a tela de Visitas foi removida da navegacao, mas o registro permanece na tabela de permissoes.

3. **CRM sem controle granular** - 5 telas CRM (Dashboard, Carteira, Visitas, Pipeline, Acoes) compartilham a mesma chave `crm_clientes`. Nao ha como habilitar/desabilitar individualmente.

4. **Tela sem permissao: `/admin/crm/metricas`** - Metricas CRM nao tem chave de permissao associada.

5. **`oficina_atividades` no grupo errado** - esta em "oficina" no DB, mas no sidebar e exibido sob "Admin > Cadastros".

6. **Grupo CRM ausente na UI de Permissoes** - o `menuGroupConfig` nao inclui um grupo para CRM, entao se criarmos chaves CRM elas ficariam sem icone/label.

### Proposta de correcao

#### 1. Migracoes no banco de dados

- **Corrigir** o menu_group de `crm_clientes`: de "Principal" para "crm"
- **Remover** registros de `visitas` (tela removida)
- **Criar novo grupo "crm"** com chaves individuais:
  - `crm_dashboard` - Dashboard CRM
  - `crm_carteira` - Carteira
  - `crm_visitas` - Visitas CRM
  - `crm_pipeline` - Pipeline
  - `crm_acoes` - Acoes CRM
- **Renomear** `crm_clientes` para `crm_carteira` (ou manter `crm_clientes` como "acesso geral CRM")
- **Mover** `oficina_atividades` do grupo "oficina" para "admin"
- **Criar** `admin_crm_metricas` no grupo "admin" para a tela de Metricas

#### 2. Tela de Permissoes (`src/pages/admin/Permissoes.tsx`)

- Adicionar grupo "crm" ao `menuGroupConfig` com icone `Briefcase` e label "CRM"

#### 3. Sidebar (`src/components/layout/AppSidebar.tsx`)

- Atualizar os `permKey` dos itens CRM para usar as novas chaves individuais

#### 4. Home (`src/pages/Home.tsx`)

- Atualizar o `permKey` do card CRM Carteira para `crm_carteira`

### Decisao necessaria

Antes de implementar, preciso saber:

- **Opcao A**: Criar chaves individuais para cada tela CRM (controle granular - dashboard, carteira, visitas, pipeline, acoes separados)
- **Opcao B**: Manter uma unica chave `crm_clientes` para todo o modulo CRM (mais simples, liga/desliga tudo junto)

As demais correcoes (bug do P maiusculo, remocao de `visitas`, oficina_atividades, metricas) serao feitas independente da opcao escolhida.

### Detalhes tecnicos

**Arquivos a editar:**
- `src/pages/admin/Permissoes.tsx` - adicionar grupo CRM ao menuGroupConfig
- `src/components/layout/AppSidebar.tsx` - atualizar permKeys dos itens CRM
- `src/pages/Home.tsx` - atualizar permKey do card CRM

**Migracoes SQL:**
- UPDATE para corrigir menu_group de "Principal" para "crm" (ou "principal")
- DELETE para remover registros de `visitas`
- INSERT para novas chaves CRM (se opcao A)
- UPDATE para mover `oficina_atividades` para grupo "admin"
- INSERT para `admin_crm_metricas`

