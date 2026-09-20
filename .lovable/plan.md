# Rastreio dos Correios por envio manual do arquivo

Como a leitura automática da pasta do Google Drive está bloqueada, o relatório diário dos Correios passa a ser enviado manualmente dentro do RumiField.

## O que muda

### 1. Desligar a execução automática
- Cancelar o agendamento diário (`sync-correios-rastreio-diario`) e apagar a senha interna guardada no cofre.
- A rotina de leitura e o campo "Código de Rastreio" na tela de Envios continuam como estão — apenas param de rodar sozinhos.

### 2. Guarda dos arquivos enviados
- Novo espaço de arquivos privado `correios-relatorios`.
- Somente Admin, Coordenador de Serviços e Coordenador de Logística podem enviar, ler e apagar arquivos nesse espaço.

### 3. Rotina aceita arquivo enviado pelo app
- A mesma rotina ganha um segundo modo: quando recebe o arquivo enviado pelo app, baixa esse arquivo direto do espaço privado (lido em windows-1252) e segue com a mesma extração de nota fiscal + rastreio e a mesma regra de atualização de hoje.
- O caminho do Google Drive permanece no código, intacto, para o dia em que o acesso for liberado.
- Autorização: além da senha interna do agendamento (mantida), a rotina também aceita um usuário logado com um dos três papéis acima.

### 4. Nova tela "Rastreio Correios"
- Em Cadastros, nova entrada "Rastreio Correios" com ícone de envio, visível só para quem já acessa Cadastros.
- Na tela: seleção de um arquivo `.htm`/`.html`, envio, processamento e resumo na hora: arquivos processados, códigos preenchidos, notas fiscais sem pedido correspondente e casos ambíguos (com os números das notas).
- Nunca sobrescreve um código de rastreio já preenchido; enviar o mesmo arquivo de novo não muda nada.

## Detalhes técnicos

- Migration: `SELECT cron.unschedule('sync-correios-rastreio-diario');` + `DELETE FROM vault.secrets WHERE name = 'sync_correios_secret';`. Nada em `pedidos`, `pedido_status` ou RLS de `pedidos`.
- Bucket via `supabase--storage_create_bucket` (`correios-relatorios`, privado, limite 20MB). Políticas em `storage.objects` para INSERT/SELECT/DELETE com `bucket_id = 'correios-relatorios'` e `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador_servicos') OR has_role(auth.uid(),'coordenador_logistica')`.
- `supabase/functions/sync-correios-rastreio/index.ts`: lê o corpo uma vez; se `storagePath` existir → `admin.storage.from('correios-relatorios').download(path)` → `TextDecoder('windows-1252')` → `extrairPares()` (inalterada) → loop de match/update existente extraído para uma função reutilizada pelos dois modos. Autorização: `X-Sync-Secret` válido OU JWT do header `Authorization` validado e checado contra `user_roles` (padrão de `_shared/auth.ts`, `requireRole`). `verify_jwt = false` mantido.
- `src/pages/admin/RelatorioCorreios.tsx`: input file, upload para `correios-relatorios/<timestamp>-<nome>`, `supabase.functions.invoke('sync-correios-rastreio', { body: { storagePath } })`, resumo em cards/listas; bloqueio de tela por `canAccess('admin_cadastros')` com mensagem de acesso negado.
- Rota `/admin/rastreio-correios` em `src/App.tsx` dentro de `AppLayout`; item novo em `adminCadastrosItems` de `AppSidebar.tsx` (ícone `Upload`, `permKey: 'admin_cadastros'`) e inclusão do caminho em `isAdminCadastrosActive`.
