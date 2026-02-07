

## Captura de Audio nas Visitas CRM -- Plano Completo

### Resumo

Adicionar gravacao de audio por produto na tela de visita CRM, com armazenamento offline-first. Na tela da visita, exibir uma secao "Audios da Visita" listando todas as gravacoes com produto associado, tamanho do arquivo, e botoes para **Transcrever**, **Resumir** e **Apagar**. A transcricao e o resumo sao processos separados acionados pelo usuario.

### Fluxo do usuario

```text
1. Na visita em andamento, clica no mic em um ProductCard
2. Grava audio -> salvo localmente (IndexedDB)
3. Na secao "Audios da Visita" aparece o registro:
   +-----------------------------------------------+
   | RumiFlow | 00:42 | 128 KB                     |
   | [Transcrever]  [Apagar]                       |
   +-----------------------------------------------+
4. Quando online, clica "Transcrever":
   -> Upload para Storage + chama edge function
   -> Exibe texto original completo inline
   +-----------------------------------------------+
   | RumiFlow | 00:42 | 128 KB                     |
   | "O cliente relatou que o sensor do tanque..."  |
   | [Resumir]  [Apagar]                           |
   +-----------------------------------------------+
5. Clica "Resumir":
   -> Chama edge function com a transcricao
   -> Exibe bullet points abaixo do texto
   +-----------------------------------------------+
   | RumiFlow | 00:42 | 128 KB                     |
   | Transcricao: "O cliente relatou que..."        |
   | Resumo:                                        |
   |  - Sensor do tanque com leitura incorreta      |
   |  - Sugerido recalibracao em 15 dias            |
   | [Apagar]                                       |
   +-----------------------------------------------+
```

### Infraestrutura

**1. Tabela: `crm_visit_audios`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| visit_id | uuid FK crm_visits | Visita associada |
| product_code | text | Codigo do produto (ideagri, rumiflow, etc.) |
| user_id | uuid FK profiles | Quem gravou |
| storage_path | text (nullable) | Caminho no Storage (preenchido apos upload) |
| file_size_bytes | integer (nullable) | Tamanho do arquivo |
| duration_seconds | integer (nullable) | Duracao da gravacao |
| transcription | text (nullable) | Texto transcrito completo |
| summary | text[] (nullable) | Bullet points do resumo |
| status | text | 'pending_upload', 'uploaded', 'transcribed', 'summarized', 'error' |
| created_at | timestamptz | |

RLS: usuarios autenticados podem CRUD onde user_id = auth.uid(). Admins/coordenadores podem SELECT em todos.

**2. Storage bucket: `crm-visit-audios`** (privado)

**3. Dexie v5: nova store `crm_visit_audios`**

Armazena o blob de audio (Uint8Array) localmente para suporte offline. Campos: id, visit_id, product_code, audioData, duration_seconds, file_size_bytes, status, created_at.

### Componentes e arquivos

**Novo: `src/components/crm/AudioRecorderButton.tsx`**
- Botao de microfone compacto usando MediaRecorder API
- Ao parar gravacao, salva no IndexedDB via Dexie
- Exibe indicador pulsante vermelho durante gravacao

**Novo: `src/components/crm/VisitAudioList.tsx`**
- Recebe visit_id como prop
- Lista todos os audios da visita (do IndexedDB + Supabase)
- Cada item mostra:
  - Nome do produto (via PRODUCT_LABELS)
  - Duracao formatada (mm:ss)
  - Tamanho do arquivo (KB/MB)
  - Botao **Transcrever** (visivel se status < transcribed e esta online)
  - Botao **Resumir** (visivel se ja tem transcricao mas nao tem resumo)
  - Botao **Apagar** (sempre visivel, com confirmacao)
- Ao clicar Transcrever:
  1. Upload do blob para bucket `crm-visit-audios`
  2. Converte blob para base64
  3. Chama edge function `transcribe-audio` (ja existente, retorna `transcription`)
  4. Salva transcricao na tabela `crm_visit_audios`
  5. Exibe texto completo inline
- Ao clicar Resumir:
  1. Chama edge function com a transcricao ja salva
  2. Pede para a IA gerar bullet points objetivos
  3. Salva array de resumo na tabela
  4. Exibe bullet points abaixo da transcricao

**Novo: `src/hooks/useCrmAudioSync.ts`**
- Hook para gerenciar upload automatico quando volta online
- Lista audios pendentes no IndexedDB
- Sincroniza em background

**Alteracao: `src/components/crm/ProductCard.tsx`**
- Nova prop `onRecordAudio?: () => void` e `audioCount?: number`
- Botao de microfone no rodape do card (ao lado do CTA existente)
- Badge com contagem de audios se > 0

**Alteracao: `src/pages/crm/CrmVisitaExecucao.tsx`**
- Estado para gravacao ativa (qual produto esta gravando)
- Renderiza `AudioRecorderButton` ao clicar no mic de um ProductCard
- Renderiza secao "Audios da Visita" com `VisitAudioList` abaixo dos produtos
- Secao visivel tanto durante visita ativa quanto apos conclusao

**Alteracao: `src/components/crm/FinalizarVisitaModal.tsx`**
- Verificar se ha audios pendentes de upload
- Aviso se offline: "X audios serao enviados quando houver conexao"

**Alteracao: `src/lib/offline-db.ts`**
- Bump para versao 5
- Nova store `crm_visit_audios` com indices: id, visit_id, product_code, status

**Alteracao: `supabase/functions/transcribe-audio/index.ts`**
- Adicionar suporte a um parametro `mode`:
  - `mode: 'transcribe'` (default): comportamento atual, retorna transcricao
  - `mode: 'summarize'`: recebe texto da transcricao e retorna array de bullet points
- Isso evita criar uma edge function separada

### Detalhes tecnicos

**Gravacao de audio:**
```text
MediaRecorder (audio/webm)
  -> blob
  -> ArrayBuffer -> Uint8Array
  -> Dexie (offline-first)
  -> Quando online: Storage upload + transcribe-audio call
```

**Edge function `transcribe-audio` -- novo modo `summarize`:**
- Recebe `{ text, mode: 'summarize' }`
- Envia para Lovable AI pedindo bullet points objetivos da visita
- Retorna `{ summary: ["ponto 1", "ponto 2", ...] }`

**Fluxo de sincronizacao:**
```text
IndexedDB (blob)
  -> Upload para Storage bucket `crm-visit-audios`
  -> Insere registro na tabela `crm_visit_audios` (status: uploaded)
  -> Usuario clica Transcrever -> base64 -> edge fn -> status: transcribed
  -> Usuario clica Resumir -> text -> edge fn -> status: summarized
```

### Arquivos envolvidos

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabela + bucket + RLS |
| `src/lib/offline-db.ts` | Dexie v5, nova store |
| `src/components/crm/AudioRecorderButton.tsx` | Criar (novo) |
| `src/components/crm/VisitAudioList.tsx` | Criar (novo) |
| `src/hooks/useCrmAudioSync.ts` | Criar (novo) |
| `src/components/crm/ProductCard.tsx` | Adicionar botao mic + badge |
| `src/pages/crm/CrmVisitaExecucao.tsx` | Integrar gravacao + listagem |
| `src/components/crm/FinalizarVisitaModal.tsx` | Aviso de pendencias |
| `supabase/functions/transcribe-audio/index.ts` | Adicionar modo summarize |

