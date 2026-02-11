
## Inteligencia do Cliente -- Pagina completa com IA

### Visao geral
Nova pagina `/crm/inteligencia` que permite selecionar um cliente, fazer perguntas livres ou usar sugestoes rapidas, e receber um resumo gerado por IA baseado em dados reais de todas as areas do sistema (preventivas, chamados, CRM, estoque, pedidos).

### Arquivos a criar

**1. `supabase/functions/client-intelligence/index.ts`** -- Edge Function principal

A funcao sera dividida em 3 etapas:

- **Etapa A -- Coleta**: Queries paralelas (Promise.all) em todas as tabelas mencionadas no prompt: clientes, tecnico_clientes, preventive_maintenance (com checklists/items), preventive_part_consumption, preventive_checklist_item_nonconformities, preventive_checklist_item_actions, technical_tickets (com timeline, tags, categories), ticket_visits, crm_visits (com audios, checklists, product_snapshots), crm_client_products (com snapshots), crm_proposals, crm_actions, crm_client_product_qualification_answers, product_health_indicators, pedidos (com itens/pecas), estoque_cliente, envios_produtos. Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS.

- **Etapa B -- Stats**: Calculo server-side de contagens, agrupamentos por status/frequencia, top NCs, top pecas, tempo medio resolucao chamados, etc. Retorna objeto `stats` estruturado para exibir nos cards do frontend SEM depender da IA.

- **Etapa C -- IA**: Monta contexto markdown com os dados coletados + stats e envia para Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) usando modelo `google/gemini-3-flash-preview` (ja configurado com `LOVABLE_API_KEY`). Retorna `{ stats, analysis, client }`.

Nota: Usara Lovable AI em vez de Anthropic -- ja esta configurado no projeto, sem necessidade de nova API key.

**2. `src/pages/crm/CrmInteligencia.tsx`** -- Pagina frontend

Componentes na pagina:
- **Header**: Titulo "Inteligencia do Cliente" com icone Brain
- **Seletor de Cliente**: Popover + Command (padrao Shadcn Combobox) buscando na tabela `clientes` por nome ou fazenda
- **Campo de pergunta**: Textarea + botao "Gerar"
- **Chips de sugestao rapida**: 8 botoes que preenchem a textarea com perguntas pre-definidas (resumo completo, pendencias, problemas recorrentes, saude CRM, historico comercial, pecas+frequencia, transcricoes, propostas)
- **Painel de stats** (exibido apos coleta, antes da IA): Grid de 6 cards com contagens (Preventivas, Chamados, Visitas CRM, Propostas, Audios, Pecas) + secao colapsavel com detalhes por area
- **Resposta da IA**: Container com borda left azul, renderizado com `react-markdown`
- **Loading bifasico**: "Coletando dados do cliente..." -> "Analisando com IA..."
- **Permissoes**: Verifica via `useMenuPermissions` (perm key `crm_inteligencia`) + fallback para roles admin/coordenador_servicos/coordenador_rplus

### Arquivos a modificar

**3. `src/App.tsx`** -- Adicionar rota
```
/crm/inteligencia -> CrmInteligencia
```
Posicionar ANTES da rota `/crm/:id` para evitar conflito de matching.

**4. `src/components/layout/AppSidebar.tsx`** -- Adicionar item no menu
Adicionar "Inteligencia" no array `mainMenuItems` junto dos itens CRM, com icone `Brain` e permKey `crm_inteligencia`.

**5. `supabase/config.toml`** -- Registrar funcao
```toml
[functions.client-intelligence]
verify_jwt = false
```

### Detalhes tecnicos da Edge Function

Queries paralelas (agrupadas no Promise.all):

```text
1.  clientes: SELECT * WHERE id = clientId
2.  tecnico_clientes: SELECT *, profiles(nome) WHERE cliente_id = clientId
3.  preventive_maintenance: WHERE client_id = clientId, limit 12, order desc
4.  preventive_part_consumption: WHERE preventive_id IN (...), limit 100
5.  preventive_checklist_item_nonconformities: via checklists do cliente, limit 50
6.  preventive_checklist_item_actions: via checklists do cliente, limit 50
7.  technical_tickets: WHERE client_id = clientId, limit 20
    + ticket_timeline, ticket_tag_links > ticket_tags, ticket_categories
8.  ticket_visits: WHERE client_id = clientId, limit 15
9.  crm_visits: WHERE client_id = clientId, limit 15
    + crm_visit_audios, crm_visit_checklists
10. crm_visit_product_snapshots: via visit_ids
11. crm_client_products: WHERE client_id = clientId
    + crm_client_product_snapshots
12. crm_proposals: via client_product_ids
13. crm_actions: WHERE client_id = clientId, limit 20
14. crm_client_product_qualification_answers: via client_product_ids
    + crm_product_qualification_items
15. product_health_indicators: WHERE produto_id in (...)
16. pedidos: WHERE cliente_id = clientId, limit 15
    + pedido_itens > pecas
17. estoque_cliente: WHERE cliente_id = clientId, limit 10
    + produtos_quimicos
18. envios_produtos: WHERE cliente_id = clientId, limit 15
```

Algumas queries sao dependentes (precisam de IDs da primeira query), entao serao feitas em 2 ondas de Promise.all.

Stats calculados server-side:
```text
- total_preventivas, por_status, ultima_data, ultima_concluida
- top_nao_conformidades (agrupadas por label, ordenadas por frequencia)
- top_acoes_corretivas (agrupadas por label)
- top_pecas (agrupadas por nome, somando qty)
- total_chamados, abertos_agora (com codigo+titulo), por_status, por_prioridade
- tempo_medio_resolucao (dias)
- tags_frequentes
- total_visitas_crm, audios_gravados, audios_transcritos
- transcricoes_recentes (ultimas 3)
- ultimo_checklist_score
- produtos_por_stage
- propostas_por_status
- acoes_crm_recentes (ultimas 10)
- pedidos_por_status, pedidos_pendentes
```

### Cores e estilo

- Preventivas: emerald (green)
- Chamados: orange/red
- CRM/Visitas: blue
- Propostas: amber
- Audios: violet
- Pecas: purple
- Resposta IA: `border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-950/20`
- Cards de contagem: icones Lucide (ClipboardCheck, AlertTriangle, Eye, FileText, AudioLines, Package)

### Fluxo do usuario

1. Abre /crm/inteligencia
2. Seleciona cliente no combobox
3. Digita pergunta ou clica numa sugestao rapida
4. Clica "Gerar"
5. Ve loading bifasico (coletando dados -> analisando com IA)
6. Painel de stats aparece primeiro (cards + detalhes colapsaveis)
7. Resposta da IA aparece abaixo em markdown formatado
8. Pode fazer nova pergunta sem reselecionar o cliente (stats ja cacheados)
