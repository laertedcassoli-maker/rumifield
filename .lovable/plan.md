

## Gravação de áudio compatível com iOS (PWA)

### Problema
O `MediaRecorder` não funciona de forma confiável no iOS em PWAs/WebViews -- o microfone ativa, mas nenhum chunk de dados é emitido, resultando em blob vazio.

### Estratégia
Abordagem híbrida por plataforma:
- **iOS**: usar `<input type="file" accept="audio/*" capture>` que abre o gravador nativo do sistema
- **Android/Desktop**: manter `MediaRecorder` atual (funciona bem)

### Detalhes Técnicos

**Arquivo:** `src/components/crm/AudioRecorderButton.tsx`

1. **Detecção de iOS**
   - Criar helper `isIOS()` que checa `navigator.userAgent` por padrões iPhone/iPad/iPod + fallback via `navigator.platform` e `maxTouchPoints`

2. **Modo iOS (input capture)**
   - Renderizar um `<input type="file" accept="audio/*" capture>` oculto
   - O botao de microfone dispara o `click()` desse input
   - No `onChange`, ler o arquivo via `FileReader.readAsArrayBuffer()`
   - Converter para `Uint8Array` e salvar no IndexedDB (mesma lógica atual do `onstop`)
   - Estimar duração usando Web Audio API (`AudioContext.decodeAudioData`) ou fallback para `null`

3. **Modo Android/Desktop**
   - Manter o código atual com `MediaRecorder` sem alterações

4. **Ajuste no VisitAudioList**
   - O iOS grava em formato `.m4a`/`.caf` (não `.webm`), então o playback e upload precisam lidar com o mime type real do arquivo capturado
   - Salvar o `mimeType` junto ao registro no IndexedDB para uso correto no playback e upload
   - Pequena alteração na tabela `crm_visit_audios` do Dexie para incluir campo `mime_type`

5. **UX**
   - No iOS, o botão de microfone abre diretamente o gravador nativo (experiência fluida)
   - Feedback visual: ao retornar do gravador nativo, exibir toast de sucesso
   - Sem mudança visual para Android/Desktop

### Arquivos modificados
- `src/components/crm/AudioRecorderButton.tsx` -- lógica híbrida iOS vs Android
- `src/components/crm/VisitAudioList.tsx` -- suporte a mime types variados no playback
- `src/lib/offline-db.ts` -- adicionar campo `mime_type` opcional na store

