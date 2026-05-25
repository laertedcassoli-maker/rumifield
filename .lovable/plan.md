## Contexto
Refatorar a seção de compartilhamento pós-visita em `AtendimentoPreventivo.tsx` para simplificar os botões "Produtor" e "Time Interno" (apenas `navigator.share`) e adicionar uma nova linha com "Copiar link" e "Baixar PDF".

## Arquivo-alvo
`src/pages/preventivas/AtendimentoPreventivo.tsx`

## Alterações

### 1. Imports
- Adicionar `Link2` e `Download` à importação do `lucide-react`.
- Remover `Share2` do `lucide-react` (não será mais usado).
- Remover `shareReportWithPdf`, `buildReportFileName`, `buildReportShareUrl` da importação de `@/lib/share-report-pdf`.

### 2. Estado
- Remover `const [sharingTarget, setSharingTarget] = useState<'produtor' | 'interno' | null>(null);` (não será mais necessário).

### 3. Variáveis de URL
Adicionar dentro do bloco de renderização da seção de compartilhamento:
```ts
const baseUrl = window.location.hostname.includes('lovableproject.com')
  ? 'https://rumifield.lovable.app'
  : window.location.origin;
const urlProdutor = `${baseUrl}/relatorio/${routeItem.publicToken}`;
const urlInterno = `${baseUrl}/relatorio/${routeItem.publicToken}/interno`;
```

### 4. Botões "Produtor" e "Time Interno"
Substituir os `onClick` atuais (que usam `shareReportWithPdf`) por `navigator.share` simples:
- **Produtor**: `navigator.share({ title: 'Relatório de Visita Preventiva', text: 'Segue o relatório da visita preventiva.', url: urlProdutor })`
- **Time Interno**: `navigator.share({ title: 'Relatório Interno', text: 'Relatório interno da visita preventiva.', url: urlInterno })`
- Remover `disabled={sharingTarget !== null}` e o estado de loading (`Loader2` condicional) em ambos.
- Manter `variant="outline"`, `className="flex-1"`, ícones `User` e `FileText`, e labels.

### 5. Nova linha de botões
Inserir logo abaixo da linha "Produtor/Time Interno":
```tsx
<div className="flex gap-2">
  <Button variant="outline" className="flex-1" onClick={async () => {
    await navigator.clipboard.writeText(urlProdutor);
    toast({ title: 'Link copiado!' });
  }}>
    <Link2 className="h-4 w-4 mr-2" />
    Copiar link
  </Button>
  <Button variant="outline" className="flex-1" onClick={() => {
    window.open(`${urlProdutor}?acao=pdf`, '_blank');
    toast({ title: 'Abrindo relatório para download...' });
  }}>
    <Download className="h-4 w-4 mr-2" />
    Baixar PDF
  </Button>
</div>
```

### 6. Fora de escopo
- Nenhuma alteração em queries, estados, mutations, validações, diálogos, checklist, consumo de peças, media upload ou outras seções do arquivo.
