

## Novo perfil "Coordenador Logistica" + restricao de acoes no Kanban

### O que sera feito

1. Criar o novo perfil `coordenador_logistica` no sistema
2. Restringir as acoes de "Processar" e "Concluir" no Kanban de pedidos para apenas `admin` e `coordenador_logistica`
3. Demais perfis verao uma tabela somente leitura na aba Transmitidos

---

### 1. Migracao no banco de dados

- Adicionar `'coordenador_logistica'` ao enum `app_role`
- Atualizar a funcao `is_admin_or_coordinator` para incluir o novo perfil (ele precisa ter acesso de gestao como os demais coordenadores)
- Inserir registros de `role_menu_permissions` para o novo perfil (copiando de um perfil base como `coordenador_servicos` e ajustando)

### 2. Contexto de autenticacao (`src/contexts/AuthContext.tsx`)

- Adicionar `'coordenador_logistica'` ao tipo `AppRole`

### 3. Labels e cores nos arquivos de UI

Atualizar os mapas `roleLabels` e `roleColors` em:
- `src/pages/admin/Permissoes.tsx` -- adicionar na lista de `roles`, `roleLabels` e `roleColors`
- `src/pages/admin/Usuarios.tsx` -- adicionar em `roleLabels` e `roleColors`
- `src/components/layout/AppSidebar.tsx` -- adicionar em `roleLabels`

### 4. Pagina de Pedidos (`src/pages/Pedidos.tsx`)

- Criar variavel `canManagePedidos` que sera `true` apenas para `admin` e `coordenador_logistica`
- Usar `canManagePedidos` para decidir:
  - Se mostra o `<PedidoKanban>` com botoes de acao (Processar/Concluir)
  - Ou se mostra uma tabela somente leitura com status, codigo e botao "Detalhes"
- A variavel `isAdmin` existente continua sendo usada para outras funcionalidades (ver todos os pedidos, etc.)

### 5. Kanban (`src/components/pedidos/PedidoKanban.tsx`)

- Nenhuma alteracao necessaria no componente em si -- ele ja recebe as acoes via props. Simplesmente nao sera renderizado para perfis sem permissao.

### 6. RLS de pedidos

- Atualizar a policy de UPDATE em `pedidos` para permitir que `coordenador_logistica` tambem possa atualizar status (hoje so o `solicitante_id` pode fazer UPDATE). Adicionar uma policy:
  - `is_admin_or_coordinator(auth.uid())` pode fazer UPDATE em pedidos (a funcao ja incluira o novo perfil)

---

### Resultado esperado

| Perfil | Aba Rascunhos | Aba Transmitidos |
|---|---|---|
| Admin | Criar, editar, transmitir | Kanban com Processar e Concluir |
| Coord Logistica | Criar, editar, transmitir | Kanban com Processar e Concluir |
| Coord R+ / Coord Servicos | Criar, editar, transmitir | Tabela somente leitura |
| Consultor / Tecnico | Criar, editar, transmitir | Tabela somente leitura |

---

### Detalhes tecnicos

**Migracao SQL:**

```text
-- 1. Adicionar novo valor ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador_logistica';

-- 2. Atualizar funcao is_admin_or_coordinator para incluir novo perfil
CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'coordenador_rplus', 'coordenador_servicos', 'coordenador_logistica')
  )
$$;

-- 3. Adicionar policy para coordenadores/admin poderem atualizar pedidos
CREATE POLICY "Admins and coordinators can update pedidos"
ON public.pedidos FOR UPDATE TO authenticated
USING (is_admin_or_coordinator(auth.uid()));

-- 4. Inserir permissoes de menu para o novo perfil
-- (copiar menus relevantes de coordenador_servicos com can_access ajustado)
INSERT INTO role_menu_permissions (role, menu_key, menu_label, menu_group, can_access)
SELECT 'coordenador_logistica', menu_key, menu_label, menu_group, 
  CASE WHEN menu_key IN ('pedidos', 'admin_envios', 'admin_permissoes', 'admin_config', 'admin_usuarios') THEN true ELSE false END
FROM role_menu_permissions
WHERE role = 'admin'
ON CONFLICT DO NOTHING;
```

**Arquivos modificados:**
- Nova migracao SQL
- `src/contexts/AuthContext.tsx` -- tipo AppRole
- `src/pages/admin/Permissoes.tsx` -- roleLabels, roleColors, roles array
- `src/pages/admin/Usuarios.tsx` -- roleLabels, roleColors
- `src/components/layout/AppSidebar.tsx` -- roleLabels
- `src/pages/Pedidos.tsx` -- logica condicional canManagePedidos + tabela readonly
