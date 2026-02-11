

## Gravação de áudio no iOS via Web Audio API

### Problema
O `<input type="file" accept="audio/*">` no iOS:
- Com `capture="environment"` → abre câmera traseira
- Com `capture="user"` → abre câmera frontal  
- Sem `capture` → seletor genérico sem opção de microfone

Nenhuma combinação abre o gravador de áudio nativo.

### Solução
Substituir a abordagem de file input no iOS por **Web Audio API** com captura PCM direta:

1. `getUserMedia({ audio: true })` → obtém stream de microfone (funciona no iOS)
2. `AudioContext` + `ScriptProcessorNode` → captura samples PCM em tempo real
3. Ao parar, codifica os samples como **WAV** (formato universal)
4. Salva no IndexedDB como antes

### Detalhes Técnicos

**Arquivo:** `src/components/crm/AudioRecorderButton.tsx`

#### Fluxo iOS (novo):
```text
Botao Mic clicado
  -> getUserMedia({ audio: true })
  -> new AudioContext()
  -> createScriptProcessor(4096, 1, 1)
  -> onaudioprocess: acumula Float32Array chunks
  -> Botao Stop clicado
  -> concatena chunks -> encodeWAV(samples, sampleRate)
  -> Uint8Array WAV salvo no IndexedDB
  -> stream.getTracks().forEach(t => t.stop())
```

#### Mudancas:
1. **Remover** toda a logica de `<input type="file">` e `handleFileCapture`
2. **Remover** `fileInputRef`
3. **Adicionar** helper `encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer` que gera um arquivo WAV valido com header de 44 bytes
4. **Adicionar** refs para `audioContextRef`, `scriptProcessorRef`, `audioChunksRef`
5. **Nova funcao** `startIOSRecording`:
   - getUserMedia
   - Cria AudioContext + ScriptProcessor
   - Acumula samples no `audioChunksRef`
   - Seta `recording = true`
6. **Nova funcao** `stopIOSRecording`:
   - Para o ScriptProcessor
   - Fecha AudioContext
   - Concatena chunks
   - Codifica WAV
   - Salva no IndexedDB com `mime_type: 'audio/wav'`
7. **UI iOS**: mesmo botao Mic/Stop que o Android (com pulse vermelho), sem mais file input
8. **Android/Desktop**: sem alteracao alguma

#### Helper encodeWAV:
Funcao pura que recebe `Float32Array` + `sampleRate` e retorna `ArrayBuffer` com header WAV (PCM 16-bit mono). Aproximadamente 30 linhas de codigo.

### Vantagens
- Funciona em iOS Safari, PWA e WebView
- getUserMedia funciona no iOS (ja confirmado pelo usuario)
- Nao depende de MediaRecorder nem de file input
- Formato WAV e universalmente suportado
- UX identica ao Android (botao gravar/parar)

### Arquivos modificados
- `src/components/crm/AudioRecorderButton.tsx` — substituir file input por Web Audio API no iOS
