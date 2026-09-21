&nbsp;

# Menu Cadastros: substituir "Produtos Químicos" + "Catálogo de Peças" por "Configurações Gerais"

Em `src/components/layout/AppSidebar.tsx`, no submenu Admin > Cadastros (`adminCadastrosItems`, linhas 158-167):

- Remover as duas entradas:
  - `{ title: 'Produtos Químicos', icon: FlaskConical, url: '/admin/config?tab=quimicos', permKey: 'admin_cadastros' }`
  - `{ title: 'Catálogo de Peças', icon: Box, url: '/admin/config?tab=pecas', permKey: 'admin_cadastros' }`
- No lugar delas (mesma posição), adicionar:
  - `{ title: 'Configurações Gerais', icon: Settings, url: '/admin/config', permKey: 'admin_cadastros' }`

`Settings` já está importado de `lucide-react` (linha 2). Demais itens do submenu (Config. CRM, Tags, Templates Checklist, Atividades, Google Sheets, Rastreio Correios) ficam intactos, assim como a checagem `isAdminCadastrosActive` (já cobre `/admin/config`).

## Intocado

- `Config.tsx` e suas abas (tela continua igual; só muda o caminho pelo menu).
- `role_menu_permissions` (mesmo permKey `admin_cadastros`, só um item a menos no menu).

## Critério de aceite

- Menu Cadastros mostra "Configurações Gerais" no lugar de "Produtos Químicos" + "Catálogo de Peças", navegando para `/admin/config` normalmente.