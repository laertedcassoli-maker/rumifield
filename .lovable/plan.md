# Unificar "quem pode cancelar" na Instalação (sem mexer na Pré Instalação)

## Estado atual confirmado (lido agora)
- **installations**:
  - UPDATE "Managers can update installations" usa `can_manage_installations()` na leitura e na checagem.
  - DELETE "Managers can delete untouched installations" usa `can_manage_installations()` e exige nenhuma etapa fora de `'planejado'`.
- **installation_stages**:
  - UPDATE "Managers can update installation_stages" usa `can_manage_installations()` na leitura e na checagem.
  - DELETE "Managers can delete installation_stages" usa `can_manage_installations() AND status='planejado'`. O seu texto não cita essa regra.
  - UPDATE "Technicians can update own installation_stages" libera o técnico ou o CSM da etapa, sem bloquear cancelamento.
- **Leitura**: também existem as regras "Authenticated users can read ..." (`USING true`). Não mexo nelas, está fora do escopo.
- **Permissões de `instalacoes`**:
  - Hoje ninguém tem `can_delete=true`, nem o admin.
  - Só existem linhas para admin, coordenador_rplus, consultor_rplus, coordenador_servicos e tecnico_campo.
  - O menu fica no grupo **"Menu Principal"**, que hoje só mostra a coluna "Ed. Finalizado". A coluna "Excluir" não aparece para ele.
- **Index.tsx**:
  - Linha 101: `podeExcluirEtapaInstalacao`, com papel fixo.
  - Linha 631: `canManage`, no botão de cancelar/excluir a instalação inteira.
  - Linha 713: `canManage` no botão de configurar etapa. Não é cancelamento e fica como está.
  - `podeGerenciarPreInstalacao` fica intocado.

## Mudanças

### Banco (uma migração)
1. **Nova função** `can_cancel_installation(_user_id uuid)`:
   - SECURITY DEFINER, com `search_path=public`.
   - Libera se for admin, ou se o papel tiver `can_delete` em `instalacoes`.
   - Retirada de PUBLIC e anon; execução só para authenticated e service_role.
2. **"Managers can update installations"**:
   - A leitura continua igual.
   - Na gravação: `can_manage_installations() AND (status IS DISTINCT FROM 'cancelado' OR can_cancel_installation(auth.uid()))`.
3. **"Managers can update installation_stages"**:
   - A leitura continua igual.
   - Na gravação: `can_manage_installations() AND (status IS DISTINCT FROM 'cancelado' OR stage = 'pre_instalacao' OR can_cancel_installation(auth.uid()))`.
4. **"Managers can delete untouched installations"**: troca para `can_cancel_installation(auth.uid())`, mantendo a condição de nenhuma etapa iniciada.
5. **Adicional, necessário para o critério "via API"**:
   - "Managers can delete installation_stages" passa a ser `can_manage_installations() AND status='planejado' AND (stage='pre_instalacao' OR can_cancel_installation(auth.uid()))`.
   - Sem isso, um consultor R+ ainda conseguiria excluir uma etapa de Instalação planejada pela API.
6. **Adicional, mesmo padrão da Corretiva**:
   - "Technicians can update own installation_stages" mantém a mesma condição.
   - A gravação ganha `AND (status IS DISTINCT FROM 'cancelado' OR stage='pre_instalacao' OR can_cancel_installation(auth.uid()))`.
   - O técnico continua executando, mas não cancela a etapa de Instalação sozinho.

### Dados
- `can_delete=true` em `instalacoes` só para admin e coordenador_servicos. Hoje os dois estão com `false`, então os dois mudam.

### Telas
- **Index.tsx**:
  - `podeExcluirEtapaInstalacao` passa a usar `canDelete('instalacoes')`, via `useMenuPermissions()`.
  - A linha 631 passa de `canManage` para `canDelete('instalacoes')`.
  - Os outros usos de `canManage` e `podeGerenciarPreInstalacao` não mudam.
- **Permissoes.tsx**:
  - Mostrar a coluna "Excluir" só na linha do menu `instalacoes`, com uma regra extra por menu.
  - Não adiciono "Excluir" ao grupo "Menu Principal" inteiro, porque isso colocaria o botão em Início, Agenda etc., onde ele não faz nada.

## Pontos de atenção
- **Quem para de cancelar**: o coordenador R+, o consultor R+ e o coordenador de logística deixam de cancelar ou excluir a instalação inteira. A logística também passa por `can_manage_installations`.
  - Continuam cancelando e excluindo só a Pré Instalação.
- **Cancelar a instalação inteira**: continua cancelando as etapas planejadas, inclusive a Pré Instalação. Isso é permitido pela regra.
- **Aviso de segurança esperado**: a função gera o mesmo aviso de segurança padrão das anteriores.

## Verificação
- Checagem de tipos limpa.
- Consulta confirmando as regras novas e as permissões gravadas.
- Nada será publicado.
