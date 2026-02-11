

## Correção: iOS abrindo câmera em vez do microfone

### Problema
O atributo `capture="environment"` no `<input>` está instruindo o iOS a abrir a câmera traseira. Para gravação de áudio, esse atributo deve ser removido.

### Solução
Remover o atributo `capture="environment"` da linha 175 de `AudioRecorderButton.tsx`. O atributo `accept="audio/*"` já é suficiente para que o iOS apresente a opção de gravar áudio pelo gravador nativo.

### Detalhe Técnico

**Arquivo:** `src/components/crm/AudioRecorderButton.tsx` (linha 175)

Antes:
```html
<input type="file" accept="audio/*" capture="environment" ... />
```

Depois:
```html
<input type="file" accept="audio/*" ... />
```

Apenas uma linha precisa ser alterada.

