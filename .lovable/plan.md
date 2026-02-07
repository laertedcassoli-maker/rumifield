

# Remover tela Clientes (/clientes) do menu e da Home

## O que sera feito
Remover o item "Clientes" (`/clientes`) do menu lateral e da Home, mantendo apenas "CRM Carteira" (`/crm/carteira`) como ponto de entrada para o modulo CRM. A rota `/clientes` sera redirecionada para `/crm/carteira` para evitar links quebrados.

## Alteracoes

### 1. Menu lateral (`src/components/layout/AppSidebar.tsx`)
- Remover a linha `{ title: 'Clientes', icon: Contact, url: '/clientes', permKey: 'crm_clientes' }` do array `mainMenuItems`

### 2. Home (`src/pages/Home.tsx`)
- Remover o item "Clientes" (`/clientes`) do array `allMainMenuItems`
- Adicionar "CRM Carteira" (`/crm/carteira`) no lugar, com icone `Briefcase` e cores apropriadas

### 3. Rotas (`src/App.tsx`)
- Alterar a rota `/clientes` para redirecionar para `/crm/carteira` em vez de renderizar `ClientesList`
- Manter a rota `/clientes/:id` que ja redireciona para `/crm/:id`

