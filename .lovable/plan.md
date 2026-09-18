# Etapa 1 — Ler a planilha de fazendas e gerar relatório de correspondência

Objetivo: descobrir quais clientes da planilha correspondem aos clientes já cadastrados no RumiField, sem gravar nada no banco.

## Situação atual (verificada)

- Existem duas integrações com Google Sheets via conta de serviço (`google-sheets` e `board-rumina`), mas **as duas leem apenas a planilha fixa do Board** — o código não aceita outra planilha como parâmetro.
- Na base há 90 clientes (82 ativos) e apenas **3 com fazenda preenchida** — confirma que o campo está praticamente vazio.

## O que será feito

1. **Permitir leitura de uma planilha informada**: ajustar a função de leitura (`google-sheets`) para aceitar, além da planilha padrão, uma planilha e aba informadas na chamada — mantendo a mesma credencial de conta de serviço e o acesso somente leitura já usados hoje.
2. **Ler a planilha indicada** (a aba do `gid=1763160126`) e apresentar: nomes exatos das colunas, total de linhas e uma amostra de 5 a 10 linhas.
3. **Gerar o relatório de correspondência** comparando o nome do cliente da planilha com `clientes.nome`, com normalização antes de comparar: remover espaços extras, maiúsculas/minúsculas, acentos e pontuação básica (pontos, vírgulas, barras, hífens), e unificar variações de "S/A"/"S.A."/"SA" e "LTDA".
   O relatório trará:
   - quantos nomes da planilha casaram com exatamente um cliente cadastrado (e a fazenda que viria de cada um);
   - quais nomes da planilha **não** encontraram nenhum cliente (lista completa);
   - quais nomes da planilha casaram com **mais de um** cliente (ambiguidade), listados à parte, sem escolha automática.
4. **Nada é gravado** nesta etapa. A gravação de `clientes.fazenda` só acontece depois da sua revisão e confirmação explícita, em um próximo passo.

## Pré-requisito

A planilha precisa estar compartilhada (leitura) com a conta de serviço do Google já usada pelo projeto. Se a leitura falhar por permissão, eu informo o e-mail da conta de serviço para você compartilhar.

## Detalhes técnicos

- `supabase/functions/google-sheets/index.ts`: aceitar `spreadsheetId` e `range` opcionais no corpo da requisição, com fallback para o secret atual (`CHAVE_GOOGLE_SHEET_TABELA_BOARD`); nenhuma mudança na assinatura JWT/WebCrypto nem nos escopos (`spreadsheets.readonly`). O gate de papéis (`admin`, `coordenador_servicos`) permanece.
- A aba será resolvida pelo `gid` via metadados da planilha e lida no formato `'<Aba>'!A:Z`.
- O matching e o relatório rodam como análise de leitura (consulta a `clientes` + comparação dos nomes), sem migration, sem alteração de RLS/schema e sem `UPDATE`.
