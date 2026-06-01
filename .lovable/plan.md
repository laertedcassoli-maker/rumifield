Ajustar a ordem do toast e a mensagem exibida no botão "Baixar PDF" em `src/pages/chamados/ExecucaoVisitaCorretiva.tsx` (linha ~1189).

**Alteração:**
- Trocar a ordem: o `toast()` será chamado ANTES de `window.open()`.
- Atualizar o conteúdo do toast para título "Gerando PDF..." e descrição instruindo o usuário a aguardar o carregamento completo das imagens antes de salvar o PDF.

**Escopo limitado:**
- Nenhuma outra lógica, estado, query, estilo ou componente da tela será modificado.