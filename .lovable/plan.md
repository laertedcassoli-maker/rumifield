## Reverter botão de compartilhamento no ExecucaoRota.tsx

### O que será feito
Reverter o botão "Compartilhar PDF" de volta ao comportamento original de compartilhamento por link, apenas no arquivo `src/pages/preventivas/ExecucaoRota.tsx`.

### Mudanças específicas

1. **Remover import** da linha 31:
   `import { sharePreventivePdf } from '@/lib/preventive-report-pdf';`

2. **Remover estado** `sharingPdfId` da linha 99 e todo código que o manipula (linha 662, 664, 681, 686, 687, 691).

3. **Substituir o bloco do botão** (linhas 660-693) pelo comportamento original:
   - URL: `${baseUrl}/relatorio/${item.public_token}` onde `baseUrl` é `'https://rumifield.lovable.app'` se `window.location.hostname.includes('lovableproject.com')`, senão `window.location.origin`
   - Tentar `navigator.share()` com `{ title: \`Relatório - ${item.client_name}\`, text: \`Confira o relatório da visita preventiva: ${url}\`, url }`
   - Se `navigator.share` lançar `AbortError`, apenas retornar
   - Fallback: `navigator.clipboard.writeText(url)` com toast `{ title: 'Link copiado!', description: 'Cole no WhatsApp para enviar' }`
   - Label: "Compartilhar"
   - Ícone: `<Share2 className="h-4 w-4" />`
   - Continua aparecendo apenas quando `item.public_token` existir

### Escopo restrito
Nenhum outro arquivo será alterado. O arquivo `src/lib/preventive-report-pdf.ts` permanece inalterado.
