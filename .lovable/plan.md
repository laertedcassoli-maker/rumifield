## Objetivo
Fazer o compartilhamento sempre liberar o link primeiro e tratar o PDF como uma etapa assíncrona: se o link estiver pronto antes, o usuário recebe confirmação imediata e vê uma mensagem pedindo para aguardar o término do PDF.

## O que vou implementar
1. **Separar o fluxo de link e PDF no utilitário de compartilhamento**
   - Ajustar `src/lib/share-report-pdf.ts` para não lançar erro fatal quando a captura do PDF falhar ou ainda não estiver pronta.
   - Retornar um resultado explícito com estados como: `link-ready`, `pdf-ready`, `pdf-pending`, `pdf-failed`.
   - Garantir que o link seja copiado/compartilhado assim que estiver disponível, independentemente do PDF.

2. **Adicionar geração de PDF em segundo plano no cliente**
   - Iniciar a geração do PDF depois que o link já tiver sido exibido/copiado.
   - Se o PDF terminar com sucesso, baixar automaticamente ou compartilhar o arquivo quando suportado.
   - Se demorar mais que o esperado, manter a UI responsiva e informar que o PDF ainda está sendo preparado.

3. **Ajustar mensagens e toasts nas telas que usam compartilhamento**
   - Atualizar os fluxos em:
     - `src/pages/chamados/ExecucaoVisitaCorretiva.tsx`
     - `src/pages/chamados/RelatorioCorretivo.tsx`
     - `src/pages/preventivas/AtendimentoPreventivo.tsx`
     - pontos equivalentes preventivos/corretivos que já usam `shareReportWithPdf`
   - Novo comportamento:
     - mensagem 1: “Link gerado/copiado com sucesso”
     - mensagem 2, se necessário: “O PDF está sendo gerado, aguarde alguns instantes”
     - mensagem 3, quando concluir: “PDF pronto” ou download iniciado
   - Evitar toast destrutivo quando o problema for apenas atraso do PDF.

4. **Preservar validações do PDF sem bloquear o link**
   - Manter a checagem de seções obrigatórias (`checklist`, fotos etc.), mas tratá-la como status do PDF, não como falha total do compartilhamento.
   - Se a seção ainda não estiver renderizada, o sistema entra em `pdf-pending` e pode tentar novamente por um curto período antes de marcar `pdf-failed`.

5. **Validação final do fluxo**
   - Verificar o caso mostrado no erro “A seção \"checklist\" não foi renderizada no PDF”.
   - Confirmar que, nesse cenário, o usuário ainda recebe o link imediatamente e não fica bloqueado por erro.
   - Confirmar que, quando o relatório completa a renderização, o PDF é de fato gerado e entregue.

## Detalhes técnicos
- O problema atual é estrutural: `shareReportWithPdf` aborta o fluxo inteiro quando `buildPdfFile()` falha, então a UI cai em `catch` e mostra erro mesmo quando o link já existe.
- Vou transformar esse utilitário em um fluxo em duas fases:
  1. resolver/compartilhar/copiar o link
  2. processar o PDF sem derrubar a fase 1
- Onde houver compartilhamento nativo com arquivo, ele continuará sendo usado quando o PDF já estiver pronto; caso contrário, o app cai para link imediato + conclusão posterior do PDF.

## Resultado esperado
Ao tocar em compartilhar:
- o **link** é sempre gerado e disponibilizado primeiro;
- se o **PDF** ainda não estiver pronto, o usuário vê um aviso para aguardar;
- quando o **PDF** terminar, ele é baixado/compartilhado sem transformar o fluxo inteiro em erro.