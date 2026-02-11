

## Correção: abrir microfone nativo no iOS

### Problema
- `capture="environment"` + `accept="audio/*"` = abre câmera
- Sem `capture` + `accept="audio/*"` = mostra seletor genérico (foto, vídeo, arquivo)
- `capture="user"` + `accept="audio/*"` = abre **microfone** nativo

### Solução
Adicionar `capture="user"` ao input de arquivo na linha 174 de `AudioRecorderButton.tsx`.

### Detalhe Técnico

**Arquivo:** `src/components/crm/AudioRecorderButton.tsx`

```html
<!-- Antes -->
<input type="file" accept="audio/*" className="hidden" ... />

<!-- Depois -->
<input type="file" accept="audio/*" capture="user" className="hidden" ... />
```

Uma única linha alterada. O atributo `capture="user"` indica ao iOS que deve usar o dispositivo de entrada voltado ao usuário (microfone para áudio, câmera frontal para vídeo/foto).
