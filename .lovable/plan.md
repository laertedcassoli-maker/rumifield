# Plano de Analytics de Uso — RumiField

Objetivo: instrumentar o RumiField para responder perguntas de Produto (telas mais usadas, abandono, campos preenchidos, cliques, funis) sem afetar performance, respeitando o contexto atual: React 18 + Vite + React Router + React Query + Supabase (Lovable Cloud), PWA online-first com Dexie apenas em fluxos específicos, RBAC via `user_roles`/`role_menu_permissions`, e uma tabela `access_logs` já existente registrando login/logout/negações.

Este documento é a entrega — não haverá código nesta fase. Após aprovação, a Fase 1 é implementada como MVP.

---

## 1. Diagnóstico do que já existe hoje

Base observada no projeto (sem inventar funcionalidades):

- **Auth e sessão**: `AuthContext` + `access_logs` (event_type: `login`, `login_denied`, `login_error`, `logout`) — já cobre parte de "Login / Logout / Sessão".
- **Roteamento**: `react-router-dom` centralizado em `src/App.tsx` — ponto natural para "Screen Viewed".
- **UI**: componentes shadcn (Button, Input, Select, Combobox, Dialog, Accordion, Tabs) — instrumentáveis via wrapper/event bus.
- **Rede**: cliente único `@/integrations/supabase/client` — permite interceptar mutations para "Entity Created/Updated/Deleted".
- **Offline**: `useOfflineSync` e `useOfflineChecklist` já têm fila persistente + dead-letter — o mesmo padrão pode ser reaproveitado para eventos de analytics offline.
- **Erros**: `ErrorBoundary`, `window.onerror`, `window.onunhandledrejection` já existem em `main.tsx` — pontos prontos para "Erro apresentado".
- **PWA**: preview/iframe desregistram SW; qualquer coleta precisa respeitar esse ambiente para não poluir dados.

Restrições reais:
- Nada de backend Node persistente (só edge functions Supabase).
- Segredos e RLS: qualquer tabela `public.*` nova exige GRANTs + policies.
- Mobile em campo com conexão instável → coleta precisa ser offline-tolerante.

---

## 2. Tabela de eventos (viabilidade técnica)

Complexidade: **B** baixa, **M** média, **A** alta.

| Evento | Dados capturados | Origem | Complex. | Observações |
|---|---|---|---|---|
| Sessão iniciada | session_id, user_id, role, device, viewport, app_version, referrer | Front | B | Gerado no boot; encerra por inatividade (>30min) ou logout. |
| Sessão encerrada | session_id, duração, motivo (logout / timeout / tab hidden) | Front | B | `visibilitychange` + `beforeunload`; usa `navigator.sendBeacon`. |
| Login | user_id, email, método (google / senha), sucesso | Front+Back | B | Já em `access_logs`; espelhar como evento analytics. |
| Logout | user_id, duração da sessão | Front | B | Idem. |
| Screen Viewed | route, params, título, referrer_route, tempo desde último screen | Front | B | Listener em `useLocation`. |
| Tempo na tela | route, dwell_ms, saída (nav / hidden / close) | Front | B | Diff entre screen views + `visibilitychange`. |
| Botão clicado | button_id/label, screen, contexto (row_id opcional) | Front | M | Wrapper `<TrackedButton>` **ou** delegação global via `data-analytics-id`. Priorizar delegação para não tocar componentes. |
| Campo alterado | form_id, field_name, tipo, preenchido (bool), tamanho | Front | M | Debounce 800ms no blur; **nunca** enviar valor bruto. |
| Campo preenchido (no submit) | form_id, fields_filled[], fields_empty[] | Front | M | Snapshot no submit. |
| Campo obrigatório ignorado | form_id, field_name, validation_error | Front | B | Hook em validações Zod já usadas. |
| Busca realizada | screen, query_length, results_count | Front | B | Não enviar termo bruto (PII); enviar hash/length. |
| Filtro aplicado | screen, filter_key, filter_type, has_value | Front | B | Instrumentar em GestãoOS e listas existentes. |
| Registro criado | entity, entity_id, screen | Back+Front | M | Emitir do front no sucesso da mutation Supabase (mais simples); ou trigger DB (mais confiável, mais complexo). |
| Registro editado | entity, entity_id, campos_alterados[] (nomes) | Front | M | Diff no client; nomes de campos, não valores. |
| Registro excluído | entity, entity_id, screen | Front | M | Idem. |
| Upload | bucket, file_type, size_bytes, screen | Front | B | Já há uploads em storage buckets (`preventive-media`, `crm-visit-audios` etc.). |
| Download / Exportação | tipo (xlsx/pdf), origem, screen | Front | B | Só onde já existe geração (PDF preventivo/corretivo). |
| Erro apresentado | screen, code, message (sanitizada), stack_hash | Front | M | Ligar em `ErrorBoundary` + toasts de erro. |
| Fluxo abandonado | flow_id, step_index, last_step, motivo | Front | M | Requer definir "fluxos" explícitos (checkin preventivo, criar pedido, executar corretiva, criar OS). |
| Latência de mutation | entity, op, duration_ms, ok | Front | B | Instrumentar helper `withTimeout`. |
| Feature flag / permissão negada | perm_key, screen | Front | B | Já existe `canAccess` em `useMenuPermissions`. |
| Path do usuário (jornada) | derivado de Screen Viewed sequencial | Front | B | Reconstruído em SQL/BI a partir dos screen views. |

**Fora do escopo viável hoje** (declarar honestamente):
- **Heatmaps reais de clique/mouse**: exigiria PostHog Session Replay ou Hotjar; possível, mas custo e privacidade a avaliar.
- **Rastreamento cross-device por usuário anônimo**: RumiField é autenticado, então isso não se aplica — o `user_id` já resolve.
- **Tempo real de foco por campo** (ms exatos entre focus/blur em cada input): tecnicamente possível, mas ruído alto e custo de eventos elevado → não recomendado no MVP.
- **Rastrear valores digitados**: proibido — PII de clientes e dados sensíveis (`clientes`, `crm_visits`, `access_logs`).

---

## 3. Arquitetura proposta

```text
                    ┌─────────────────────────────┐
                    │  Componentes React (shadcn) │
                    │  data-analytics-id="..."    │
                    └──────────────┬──────────────┘
                                   │
                     ┌─────────────▼──────────────┐
                     │  analytics.ts (event bus)  │
                     │  track(name, props)        │
                     │  identify(user)            │
                     │  screen(route)             │
                     └─────────────┬──────────────┘
                        enrich (session, user, role, app_version, route)
                                   │
                     ┌─────────────▼──────────────┐
                     │  Buffer + Batcher          │
                     │  - flush a cada 10s/20 ev. │
                     │  - sendBeacon no unload    │
                     │  - Dexie fila se offline   │
                     └─────────────┬──────────────┘
                                   │
                     ┌─────────────▼──────────────┐
                     │  Edge Function             │
                     │  ingest-analytics          │
                     │  (verify_jwt = true)       │
                     └─────────────┬──────────────┘
                                   │
                     ┌─────────────▼──────────────┐
                     │  public.analytics_events   │
                     │  RLS: user vê próprios;    │
                     │  admin/coord: todos        │
                     └─────────────┬──────────────┘
                                   │
                          Views agregadas / BI
```

Princípios:
- **Um único event bus** (`src/lib/analytics/index.ts`) — nada de SDK espalhado nos componentes.
- **Instrumentação por delegação de eventos**: um listener global captura clicks em elementos com `data-analytics-id`, evitando trocar botões existentes.
- **Batching + `sendBeacon`**: nunca bloquear a UI; nunca perder eventos no unload.
- **Reaproveitar padrão offline** do `useOfflineSync` para fila local Dexie e retry com backoff.
- **Sem PII em `properties`**: apenas IDs, enums, contagens, tamanhos e hashes.
- **Amostragem opcional** para eventos ruidosos (screen dwell, field change) via env flag.

Schema mínimo (a definir em migration na Fase 1, com GRANTs + RLS):

```
analytics_events(
  id uuid pk,
  occurred_at timestamptz,
  user_id uuid,           -- fk auth.users (nullable p/ pre-login)
  session_id text,
  event_name text,        -- ex: 'screen_viewed'
  screen text,
  entity text,
  entity_id uuid,
  properties jsonb,       -- <= 4KB, sem PII
  app_version text,
  device jsonb,           -- ua, viewport, platform
  ingested_at timestamptz default now()
)
-- índices por (occurred_at), (user_id, occurred_at), (event_name, occurred_at)
```

---

## 4. Comparativo de ferramentas

| Ferramenta | Prós p/ SaaS B2B backoffice | Contras | Recomendação |
|---|---|---|---|
| **GA4** | Grátis, familiar | Modelo pensado p/ marketing/e-commerce; ruim p/ eventos autenticados granulares; sampling; consultas SQL só via BigQuery export | Não recomendado como principal. |
| **GTM** | Facilita disparo sem deploy | É orquestrador, não analytics; depende de destino (GA4/PostHog) | Opcional, só se marketing pedir. |
| **PostHog (Cloud ou self-host)** | Product analytics + funil + retenção + session replay + feature flags nativos; SQL direto; bom com apps autenticados; SDK web maduro; pode self-host | Custo cresce com replay ligado; setup de replay exige cuidado com PII (mascarar campos) | **Recomendado como principal.** |
| **Mixpanel** | Excelente análise de funil/retenção; UI polida | Caro por MTU; sem session replay nativo; export SQL limitado no plano básico | Alternativa ao PostHog, mais caro. |
| **Amplitude** | Muito bom em jornadas e cohort | Modelo de preço menos previsível p/ B2B pequeno | Alternativa. |

**Recomendação**: **PostHog** como camada de produto + **tabela própria `analytics_events` no Supabase** como fonte de verdade auditável. Motivos:

1. RumiField já é 100% autenticado → PostHog encaixa perfeitamente com `identify(user_id, {role, tenant})`.
2. Suporta funis, retenção, path analysis (responde diretamente às perguntas do briefing).
3. Feature flags nativos podem substituir controles caseiros no futuro.
4. Session replay opcional (ligar só em fluxos-alvo, com máscara agressiva de PII).
5. Duplicar em `analytics_events` no Supabase dá independência de fornecedor e permite juntar com dados de negócio (ex.: OS por cliente x uso do dashboard).

---

## 5. KPIs viáveis

**Uso e adoção**
- DAU / WAU / MAU por role.
- Retenção W1/W4 por role.
- Adoção de novas funcionalidades (% usuários que dispararam evento X em 30 dias após release).
- Telas mais e menos acessadas (Screen Viewed).
- Telas sem acesso em 30/60/90 dias (candidatas a remoção).
- Tempo médio por tela / p50/p95.
- Path analysis: caminhos mais comuns a partir do Início.

**Formulários / dados**
- Campos nunca preenchidos por formulário.
- Taxa de validação falha por campo (obrigatório ignorado).
- Tempo médio para completar um formulário (checkin, nova OS, novo pedido).

**Funis (definir explicitamente na Fase 2)**
- Preventiva: `route_started → checkin → checklist_all_answered → checkout → report_shared`.
- Corretiva: `ticket_opened → visit_scheduled → visit_started → visit_finished → report_shared`.
- Pedido de peças: `draft_created → items_added → transmitted → concluded`.
- CRM: `client_opened → visit_created → checkout → proposal_created → won`.

**Qualidade e saúde**
- Taxa de erro por tela (Erro apresentado / Screen Viewed).
- Latência p95 de mutations por entidade.
- Fila offline: itens pendentes, dead-letter por usuário.

**Permissionamento**
- Cliques em itens sem permissão (potencial confusão de UI).
- Uso real por `role` vs. permissões concedidas (limpeza de roles).

---

## 6. Privacidade / segurança

- Nunca capturar valor de input, apenas nome do campo, tipo e se foi preenchido.
- Mascarar toda `PII` em session replay (se ligado no futuro): `data-ph-no-capture` em inputs, nomes, endereços, telefones, coordenadas de fazenda.
- Sanitizar `error.message` antes de enviar (remover tokens/UUIDs/URLs assinadas).
- Ingest via edge function com `verify_jwt = true` (mesmo padrão do endurecimento recente).
- RLS: usuário lê próprios eventos; `admin`/`coordenador_*` leem todos (via `has_role`).
- Retenção: definir TTL (ex.: 180 dias em `analytics_events`, agregados anuais em views materializadas).

---

## 7. Impacto em performance

- Event bus síncrono em memória, flush assíncrono em `requestIdleCallback` / setTimeout 10s.
- Payload comprimido (batch JSON) via `fetch` com `keepalive` ou `navigator.sendBeacon` no unload.
- Amostragem configurável para eventos de alta frequência (dwell time, field change).
- Sem dependência bloqueante no boot — SDK carrega após `first paint`.
- Zero mudança no cliente Supabase; interceptação de mutations feita em wrappers opcionais.

---

## 8. Plano de implementação

### Fase 1 — MVP (1 sprint)
Objetivo: ligar a coleta com o mínimo de intrusão e já responder "telas mais/menos usadas", "login/logout", "erros por tela".

1. `src/lib/analytics/index.ts`: event bus + batcher + `sendBeacon` + fila Dexie offline.
2. Enriquecimento automático: `session_id`, `user_id`, `role`, `app_version`, `route`, `viewport`.
3. Instrumentação automática:
   - `screen_viewed` via listener em `useLocation`.
   - `session_started` / `session_ended` (visibility + beforeunload + inatividade 30 min).
   - `login` / `login_denied` / `login_error` / `logout` reaproveitando `access_logs`.
   - `error_shown` em `ErrorBoundary` e em toasts destrutivos.
4. Migration: tabela `public.analytics_events` + GRANTs + RLS + índices.
5. Edge function `ingest-analytics` com `verify_jwt = true` e validação de schema.
6. Provisionar PostHog e enviar em paralelo (mesmo bus, dois sinks).
7. Dashboard inicial (PostHog): DAU/WAU, top screens, erro por tela.

### Fase 2 — Interações e formulários (1–2 sprints)
1. Delegação global de `data-analytics-id` para `button_clicked`.
2. Adicionar `data-analytics-id` nas telas prioritárias: Gestão de OS, Pedidos, Preventivas (execução), Corretivas (execução), CRM Carteira/Pipeline.
3. Instrumentar `filter_applied` nos filtros já existentes de GestaoOS e listas.
4. `form_submitted` + `field_required_skipped` nos formulários com Zod já mapeados (Auth, Nova OS, Novo Pedido, Checkin preventivo, Nova visita CRM).
5. `entity_created/updated/deleted` via helper opcional envolvendo mutations críticas.
6. Definição formal dos 4 funis (preventiva, corretiva, pedido, CRM) no PostHog.

### Fase 3 — Profundidade e ativação de Produto
1. Path analysis e retenção por coorte de role.
2. Views agregadas em Supabase (`v_screen_daily`, `v_funnel_preventiva`) para BI interno / painel para Produto dentro do próprio RumiField (uso do admin).
3. Session replay do PostHog ligado apenas em fluxos-alvo, com máscara agressiva de PII.
4. Feature flags do PostHog substituindo gates manuais onde fizer sentido (sem tocar RLS).
5. Alertas: queda de uso semana a semana, pico de erro por tela, aumento de dead-letter.
6. Política de retenção e limpeza automática (`pg_cron`).

---

## 9. Riscos e mitigação

- **PII vazando para PostHog** → política estrita "nomes de campos, nunca valores" + code review + `data-ph-no-capture`.
- **Custo PostHog crescer com replay** → replay desligado por padrão, ligar por feature flag em fluxo específico.
- **Volume da tabela `analytics_events`** → índices por tempo, particionamento futuro por mês se passar de ~50M linhas, TTL de 180 dias.
- **Instrumentação enviesada** → checklist de eventos obrigatórios por PR novo (documentar em `README`).
- **Offline gerando picos ao reconectar** → reaproveitar backoff + dead-letter já existentes.

---

## 10. Entregáveis desta fase (após aprovação)

Fase 1 entrega, em ordem:
1. Migration `analytics_events` + edge function `ingest-analytics`.
2. `src/lib/analytics/*` (bus, sinks Supabase + PostHog, session, fila offline).
3. Hooks: `useScreenTracking`, `useSessionTracking`.
4. Integração em `App.tsx`, `AuthContext.tsx`, `ErrorBoundary.tsx`.
5. Documento curto em `README` com o contrato de eventos.

Nada além disso será tocado no MVP.
