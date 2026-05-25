## Contexto
Atualmente os botões "Produtor" e "Time Interno" na tela de execução de visita corretiva usam a função `shareReportWithPdf` (de `@/lib/share-report-pdf`), que tenta gerar PDF, copiar link e compartilhar ao mesmo tempo. O usuário quer simplificar: os botões de "Produtor" e "Time Interno" devem apenas chamar `navigator.share` nativo, e novos botões "Copiar link" e "Baixar PDF" devem ser adicionados separadamente.

## Arquivo-alvo
`src/pages/chamados/ExecucaoVisitaCorretiva.tsx`

## Alterações

### 1. Imports
- Adicionar `Link2` e `Download` à importação do `lucide-react`.
- Remover `shareReportWithPdf`, `buildReportFileName`, `buildReportShareUrl` da importação de `@/lib/share-report-pdf` (não serão mais utilizados).

### 2. Variáveis de URL
Adicionar após as declarações de estado (próximo às outras variáveis derivadas):
```ts
const origin = window.location.hostname.includes('lovableproject.com')
  ? 'https://rumifield.lovable.app'
  : window.location.origin;
const urlProdutor = `${origin}/relatorio-corretivo/${visit.publicToken}`;
const urlInterno = `${origin}/relatorio-corretivo/${visit.publicToken}/interno`;
```

### 3. Botão "Produtor" (linha ~1118)
Substituir o `onClick` atual (que usa `shareReportWithPdf`) por:
```tsx
onClick={async () => {
  try {
    await navigator.share({
      title: 'Relatório de Visita',
      text: 'Segue o relatório da visita corretiva.',
      url: urlProdutor
    });
  } catch {}
}}
```
- Manter `variant="outline"`, `className="flex-1"`, ícone `Share2`, label "Produtor".
- Remover o `disabled={sharingTarget !== null}` e o estado de loading nesse botão (já que agora é só `navigator.share`).

### 4. Botão "Time Interno" (linha ~1158)
Substituir o `onClick` atual por:
```tsx
onClick={async () => {
  try {
    await navigator.share({
      title: 'Relatório Interno',
      text: 'Relatório interno da visita corretiva.',
      url: urlInterno
    });
  } catch {}
}}
```
- Manter estilo, ícone e label. Remover `disabled` e loading.

### 5. Nova linha de botões: "Copiar link" e "Baixar PDF"
Inserir entre a linha "Produtor/Time Interno" e a linha "Ver Chamado/Minhas Rotas":
```tsx
<div className="flex gap-2">
  <Button
    variant="outline"
    className="flex-1"
    onClick={async () => {
      await navigator.clipboard.writeText(urlProdutor);
      toast({ title: 'Link copiado!' });
    }}
  >
    <Link2 className="h-4 w-4 mr-2" />
    Copiar link
  </Button>
  <Button
    variant="outline"
    className="flex-1"
    onClick={() => {
      window.open(`${urlProdutor}?acao=pdf`, '_blank');
      toast({ title: 'Abrindo relatório para download...' });
    }}
  >
    <Download className="h-4 w-4 mr-2" />
    Baixar PDF
  </Button>
</div>
```

### 6. Botões "Ver Chamado" e "Minhas Rotas"
Permanecer exatamente como estão.

## Fora de escopo
- Nenhuma alteração em queries, estados, mutations, validações, diálogos ou outras seções do arquivo.
