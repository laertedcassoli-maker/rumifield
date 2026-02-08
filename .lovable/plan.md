

## Reorganizar menus de Administracao

### Problema atual
O menu de Administracao tem 9+ itens soltos no primeiro nivel, alem de 2 submenus (Manutencao, Oficina). Isso dificulta a navegacao:
- "Cadastros" mistura configuracoes do sistema, catalogos de produtos e integracoes na mesma tela
- "Permissoes" fica isolado quando e uma funcao de gestao de acesso junto com "Usuarios"
- "Documentacao" e "API Docs (IA)" sao dois itens para o mesmo contexto
- "Teste Transcricao" e um item de desenvolvimento misturado com itens operacionais

### Proposta de reorganizacao

**Estrutura atual do menu Administracao:**
```text
Administracao
  Clientes
  Usuarios
  Envios
  Cadastros          (tabs: Config, Prod. Quimicos, Pecas, Integracoes)
  Config. CRM
  Permissoes
  Documentacao
  API Docs (IA)
  Teste Transcricao
  > Manutencao
      Templates Checklist
  > Oficina
      Atividades
```

**Nova estrutura proposta:**
```text
Administracao
  Clientes
  Usuarios
  Permissoes
  Envios
  > Cadastros
      Produtos Quimicos
      Catalogo de Pecas
      Config. CRM
      Templates Checklist
      Atividades Oficina
  > Configuracoes
      Geral              (garantia motor, configs do sistema)
      Integracoes        (Omie, iMilk)
  > Documentacao
      Documentos
      API Docs (IA)
      Teste Transcricao
```

### Mudancas principais

1. **Agrupar "Permissoes" junto com "Usuarios"** -- ambos tratam de gestao de acesso/pessoas, entao ficam proximos no menu (nao dentro de submenu, apenas reposicionados)

2. **Transformar "Cadastros" em submenu com subitens reais** -- cada aba atual vira uma rota propria ou submenu. Isso tira o peso da pagina Config.tsx (1559 linhas!) e facilita o acesso direto:
   - Produtos Quimicos (`/admin/cadastros/produtos`)
   - Catalogo de Pecas (`/admin/cadastros/pecas`)
   - Config. CRM (ja existe em `/admin/crm`)
   - Templates Checklist (ja existe em `/preventivas/checklists`)
   - Atividades Oficina (ja existe em `/oficina/atividades`)

3. **Criar submenu "Configuracoes"** com:
   - Geral: garantia motor e outras configs do sistema (a aba "Configuracao" atual)
   - Integracoes: Omie e iMilk (a aba "Integracoes" atual)

4. **Agrupar Documentacao** em submenu unico:
   - Documentos (`/docs`)
   - API Docs IA (`/docs/api-docs-ai-layer`)
   - Teste Transcricao (`/teste`)

### Detalhes tecnicos

**Arquivos editados:**

- `src/components/layout/AppSidebar.tsx` -- reestruturar os arrays de menu admin para usar submenus `Collapsible` ao inves de itens soltos
- `src/pages/admin/Config.tsx` -- remover as tabs e dividir em paginas separadas OU simplificar para manter apenas "Geral" e "Integracoes"
- `src/pages/Home.tsx` -- atualizar o array `allAdminMenuItems` para refletir a nova organizacao
- `src/hooks/useMenuPermissions.ts` -- possivelmente adicionar novas permKeys se necessario para os novos subitens

**Abordagem de implementacao:**

Fase 1 (minima): Reorganizar apenas o `AppSidebar.tsx` agrupando os itens existentes em submenus colapsaveis, sem criar novas paginas. As rotas permanecem as mesmas, muda apenas a hierarquia visual do menu.

Fase 2 (opcional, futura): Separar Config.tsx em paginas independentes para cada aba.

Vou implementar a **Fase 1** -- reorganizar o sidebar e a Home para refletir a nova hierarquia, mantendo as mesmas rotas/paginas existentes.
