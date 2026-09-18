# Instalações — schema de responsável CSM, anexo de e-mail de venda e aprovação

Somente banco de dados nesta etapa. Nenhuma tela muda; o fluxo de aprovação e a interface vêm depois.

## O que será feito

1. **Novos campos na etapa da instalação** (`installation_stages`), todos opcionais:
   - responsável CSM (paralelo ao responsável técnico já existente);
   - caminho do anexo do "e-mail de venda";
   - quem aprovou e quando aprovou.

2. **Responsável pode ser técnico ou CSM**: quem estiver indicado como CSM na etapa passa a ter exatamente a mesma capacidade de gravar a execução do checklist que o técnico já tem hoje.

3. **Novo local privado de arquivos** para anexos de instalação, acessível apenas ao responsável da etapa (técnico ou CSM) e a quem gerencia instalações.

4. O status `aguardando_aprovacao` não exige mudança de banco — a coluna de status já aceita qualquer texto.

## Detalhes técnicos

Migration única:

- `ALTER TABLE public.installation_stages ADD COLUMN csm_user_id UUID REFERENCES auth.users(id)`, `sales_email_attachment_path TEXT`, `approved_by UUID REFERENCES auth.users(id)`, `approved_at TIMESTAMPTZ` — todas nullable, sem CHECK de exclusividade (validação na aplicação).
- Nova função `public.is_installation_stage_responsible(_user_id uuid, _stage_id uuid)` SECURITY DEFINER, STABLE, `SET search_path = public`: true quando `technician_user_id = _user_id OR csm_user_id = _user_id`.
- Recriar (DROP + CREATE) as policies de escrita de execução que hoje chamam `is_installation_stage_technician`, trocando pela nova função, mantendo o mesmo corpo/joins já existentes em:
  - `installation_checklists` (INSERT e UPDATE do responsável)
  - `installation_checklist_blocks`
  - `installation_checklist_items`
  - `installation_checklist_item_actions`
  - `installation_checklist_item_nonconformities`
  - `installation_part_consumption`
- `installation_stages`: policy de escrita do responsável passa a aceitar `technician_user_id = auth.uid() OR csm_user_id = auth.uid()`.
- `is_installation_stage_technician` permanece existindo, sem alteração.
- Bucket privado `instalacao-anexos` criado pela ferramenta de storage; policies de `storage.objects` para `authenticated` (SELECT/INSERT/UPDATE/DELETE), no padrão de `pedido-anexos`: `bucket_id = 'instalacao-anexos' AND ((storage.foldername(name))[1]::uuid IN (SELECT id FROM public.installation_stages WHERE technician_user_id = auth.uid() OR csm_user_id = auth.uid()) OR public.can_manage_installations())`. Path `<stage_id>/<arquivo>`.
- Regenerar `src/integrations/supabase/types.ts` ao final.

## Fora de escopo

- Nenhuma alteração em `installations`, no CHECK de `stage` (`pre_venda` permanece), na etapa `instalacao`, nem em Preventivas/Chamados/Pedidos.
