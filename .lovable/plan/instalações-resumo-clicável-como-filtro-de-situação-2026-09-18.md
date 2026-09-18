# Instalações — resumo clicável como filtro de situação

## Contexto atual (verificado)

- `src/pages/instalacoes/Index.tsx`:
  - `visibleInstallations` (linhas ~152-168): filtra por `etapaFiltro` (`?etapa=`), mantendo instalações sem etapa visíveis para quem gerencia e mostrando instalações com Pré Instalação existente na visão "Instalação" (lock).
  - `resumo` useMemo (linhas ~172-187): conta total/concluidas/emPreInstalacao/emInstalacao/semEtapa sobre `installations` (ignora `?etapa=`).
  - Badges do resumo (linhas ~426-446): `<div>` estáticos, sem clique.
- Padrão de toggle do projeto (`src/pages/Pedidos.tsx`): filtros como `Button` com `variant` destacado quando ativo, clique de novo desativa.

## Mudanças (só em `src/pages/instalacoes/Index.tsx`)

### 1. Função reutilizável de classificação

Nova função (fora do componente, nível de módulo):

```ts
type SituacaoInstalacao = 'concluida' | 'pre_instalacao' | 'instalacao' | 'sem_etapa';

function classificarSituacao(inst: InstallationRow): SituacaoInstalacao {
  if (inst.status === 'concluido') return 'concluida';
  if (inst.stages.some(s => s.stage === 'instalacao')) return 'instalacao';
  if (inst.stages.some(s => s.stage === 'pre_instalacao')) return 'pre_instalacao';
  return 'sem_etapa';
}
```

Ordem preservada exatamente como no resumo atual: concluída primeiro; não-concluída com etapa `instalacao` → 'instalacao'; não-concluída só com `pre_instalacao` → 'pre_instalacao'; sem nenhuma etapa → 'sem_etapa'. (Uma instalação não-concluída que tivesse ambas as etapas conta em `emInstalacao` hoje; a classificação acima mantém essa precedência.)

`resumo` passa a contar com `classificarSituacao` (`list.filter(i => classificarSituacao(i) === 'concluida').length`, etc.) — sem duplicação.

### 2. Novo estado

```ts
const [filtroSituacao, setFiltroSituacao] = useState<'all' | SituacaoInstalacao>('all');
```

### 3. Badges viram botões

Cada badge vira `Button` (pill redonda, mesmo visual atual: `rounded-full border bg-card px-3 py-1 text-xs h-auto`) com:

- `variant="default"` quando ativo (filtroSituacao corresponde), `variant="outline"` quando inativo.
- Clique: se já ativo → `setFiltroSituacao('all')` (toggle); senão → ativa a situação.
- "Total" sempre com contagem geral e clique sempre volta para 'all' (limpar filtro).
- "Sem etapa" continua aparecendo só quando a contagem > 0.

### 4. Combinação de filtros em visibleInstallations

Adicionar `filtroSituacao` às dependências e ao filtro:

- Com `?etapa=` na URL: `etapaFiltro` continua filtrando como hoje, e adicionalmente `classificarSituacao(inst) === filtroSituacao` quando filtroSituacao !== 'all'.
- Sem `?etapa=`: hoje a lista inteira é mostrada; passa a filtrar por situação quando filtroSituacao !== 'all'.
- As regras das linhas 157-159 (instalações sem etapa permanecem visíveis para gestores na visão filtrada; lock da etapa Instalação) ficam intactas.

## Não alterar

- Filtro `?etapa=` da URL, submenu do menu lateral.
- Exclusão, criação, execução, aprovação, anexo de e-mail de venda.
- Recorte de acesso do técnico de campo.

## Validação

- Typecheck (`bunx tsgo --noEmit`) e build.
- Playwright: clicar "Concluídas" mostra só concluídas; clicar de novo restaura; badges combinam com `?etapa=instalacao`; contagens dos badges não mudam com o filtro ativo.
