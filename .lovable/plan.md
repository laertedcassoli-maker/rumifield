# Código de rastreio dos Correios automático

Ler diariamente os relatórios diários dos Correios (arquivos `.htm`) salvos numa pasta do Google Drive e preencher sozinho o código de rastreio dos pedidos, a partir do número da nota fiscal.

## O que será criado

### 1. Rotina de leitura dos relatórios
Uma nova rotina no backend (`sync-correios-rastreio`) que:
- Entra na conta Google de serviço já usada nas outras integrações (somente leitura no Drive).
- Lista os arquivos `.htm`/`.html` da pasta indicada (pasta padrão: `19tlXF8v27ZgA5OavuTW3ZCLvFcAViI9_`, podendo ser trocada na chamada).
- Baixa cada arquivo lendo no charset windows-1252, para os acentos não virarem lixo.
- Extrai os pares "nota fiscal + código de rastreio" por padrão de texto (o HTML é malformado, então não se usa leitura estruturada).
- Para cada par: procura o pedido cuja NF (primeira ou segunda) bate e que ainda está sem código de rastreio.
  - Exatamente 1 pedido: grava o código.
  - Nenhum pedido: ignora (remessa de outro contexto).
  - Mais de 1 pedido: não grava e reporta como ambíguo.
- Nunca sobrescreve um código já preenchido; rodar de novo no mesmo arquivo não muda nada.
- Um arquivo com problema é pulado e reportado, sem interromper os demais.
- Devolve um resumo: arquivos processados, códigos preenchidos, NFs sem pedido e casos ambíguos (com os números das NFs).

### 2. Execução automática diária
- A rotina roda todo dia às 19:00 de Brasília (22:00 UTC), depois de o relatório dos Correios chegar (por volta das 17h), sem ninguém precisar clicar.
- A chamada automática é protegida por uma senha interna dedicada, gerada aleatoriamente na hora de aplicar e guardada em cofre. Chamadas sem essa senha são recusadas sem executar nada. A senha nunca aparece em log nem em mensagem de erro.
- Um agendamento por dia, uma vez ao dia — é o mínimo necessário para o relatório diário dos Correios, e o atraso máximo entre o relatório chegar e o código aparecer é de até 24h.

### 3. Exibição em Envios
Na tela de detalhe do pedido, logo abaixo da caixa "NF / Faturado em" (e só quando o pedido já tem NF), aparece **Código de Rastreio**:
- Se houver código: mostra o código.
- Sem código e faturado a partir de 01/09/2026: "Em separação".
- Sem código e faturado antes de 01/09/2026: "Não disponível".

## Detalhes técnicos

- `supabase/functions/sync-correios-rastreio/index.ts`: JWT RS256 assinado via WebCrypto no mesmo padrão de `google-sheets`, credencial de `GOOGLE_SERVICE_ACCOUNT_JSON` (fallback `CREDENCIAL_GOOGLE`), escopo `drive.readonly`. Endpoints: `GET /drive/v3/files?q='<folderId>' in parents and trashed=false`, download por `GET /drive/v3/files/{id}?alt=media` com `TextDecoder('windows-1252')`.
- Extração: varredura das linhas de remessa por regex; NF = coluna "N.Fiscal" (numérica), rastreio = coluna "Qtd./Reg." validada por `^[A-Z]{2}\d{9}[A-Z]{2}$`.
- Atualização com service role: `update pedidos set codigo_rastreio` filtrando `codigo_rastreio is null` e `or(omie_nf_numero.eq.NF,omie_nf_numero_2.eq.NF)`; contagem prévia decide único/nenhum/ambíguo. Sem mudança em `pedido_status`, triggers ou RLS.
- `supabase/config.toml`: `[functions.sync-correios-rastreio] verify_jwt = false`; validação em código do header `X-Sync-Secret` contra `SYNC_CORREIOS_SECRET`.
- Agendamento por `cron.schedule` + `net.http_post`, com o segredo lido de `vault.decrypted_secrets` (`sync_correios_secret`), aplicado com o valor real gerado na hora (sem placeholder).
- UI: bloco novo em `src/pages/Pedidos.tsx` dentro do mesmo `viewingPedido.omie_nf_numero &&`; nada mais da tela, filtros, Kanban ou diálogos é alterado.

## Ponto de atenção

A pasta do Drive precisa estar compartilhada com o e-mail da conta de serviço (o mesmo já usado nas planilhas). Se não estiver, a listagem volta vazia — nesse caso eu informo o e-mail para você compartilhar a pasta.
