# Grupo G: aprovação da Pré Instalação e correção do "Exigir foto"

## O que muda
1. **Checklist:** o botão "Exigir foto" passa a aparecer marcado ao reabrir o editor, quando foi salvo marcado.
2. **Aprovar direto:** "Aprovar Pré Instalação" salva o que está preenchido na tela e aprova, tudo de uma vez. "Salvar rascunho" continua disponível para quem quer só guardar os dados.
3. **Sem trava de Sim/NA:** dá para aprovar mesmo com algum item em "Não". O aviso amarelo "Faltam para liberar a aprovação" sai da tela.
4. **Previsão:** quando um dos 5 critérios estiver em "Não", aparece logo abaixo dele um campo de data "Previsão". Se o item mudar para Sim ou NA, a previsão é apagada ao salvar.
5. **Depois de aprovar:** a tela volta para Instalações, na aba "Todas".

Continuam iguais: quem pode editar, ver ou não ver os critérios, e o retorno automático do técnico depois do checklist.

## Detalhes técnicos
- **Migração:** cinco novas colunas `date` que aceitam vazio em `installation_stages`: `tem_equipamento_previsao_data`, `tem_quimico_previsao_data`, `pistolas_previsao_data`, `install_kit_previsao_data`, `mangueira_previsao_data`.
- **ChecklistEditor.tsx:** incluir `requires_photo` no select dos `checklist_template_items`, logo depois de `active`.
- **AprovacaoPreInstalacaoForm.tsx**
  - `AprovacaoCriterios` ganha os cinco campos de previsão.
  - Cada critério tem seu próprio estado local para a previsão, que usa os props só como valor inicial, conforme a regra do projeto. Um `<Input type="date">` aparece quando o valor é `'nao'`.
  - O objeto `atual` envia a previsão como `null` quando o critério não está em "Não".
  - Nova prop `valuesRef?: MutableRefObject<AprovacaoCriterios | null>`, preenchida a cada render com `atual`. Isso deixa os valores digitados disponíveis para a página, sem usar `useEffect`.
  - Remover o aviso de pendentes. `criteriosPendentes` deixa de ser usada para bloquear.
- **ExecucaoEtapa.tsx**
  - O select da etapa e o objeto `criterios` passam a incluir as cinco colunas de previsão.
  - Criar `criteriosRef` e passá-lo ao formulário.
  - Tirar o bloqueio por `criteriosIncompletos` do botão Aprovar.
  - `approveMutation` faz um único update com `{ ...criteriosRef.current, status: 'concluido', approved_by, approved_at }`, usando `.select('id')` e limite de 15s.
  - No `onSuccess`: as invalidações de sempre e `navigate('/instalacoes')`, que é a aba "Todas", pois abre sem `?etapa`.

## Validação
- Checagem de tipos.
- Consulta ao banco para confirmar que as colunas existem.
- Playwright, se houver uma Pré Instalação aguardando aprovação: marcar um item como "Não", preencher a previsão e aprovar sem salvar rascunho antes. Depois conferir no banco o status `concluido`, a data de previsão e a volta para /instalacoes. Se não houver etapa nesse estado, a validação fica só no código.
