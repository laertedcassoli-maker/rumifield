# Cores fixas para Lenilton, Roger e Phelipe na Agenda de Operações

## Contexto
Em `src/pages/AgendaOperacoes.tsx`, a função `corPorTecnico` (linha ~49) atribui cor por hash determinístico sobre `PALETA_TECNICOS` para qualquer nome. Os três técnicos de campo fixos do fluxo de peças (Lenilton, Roger, Phelipe) devem ter cores pastéis próprias, independentes do hash.

## Mudança (só `src/pages/AgendaOperacoes.tsx`)

1. Adicione um mapa `CORES_FIXAS_TECNICOS` antes de `corPorTecnico`:
   ```ts
   const CORES_FIXAS_TECNICOS: Record<string, string> = {
     'lenilton': 'hsl(32, 70%, 55%)',  // laranja suave
     'roger':    'hsl(142, 45%, 48%)', // verde suave
     'phelipe':  'hsl(270, 40%, 65%)', // lilás suave
   };
   ```
2. Em `corPorTecnico`, logo após o guard `if (!nome)`, consulte o mapa com o nome normalizado:
   ```ts
   const fixed = CORES_FIXAS_TECNICOS[nome.trim().toLowerCase()];
   if (fixed) return fixed;
   ```
   O hash e `PALETA_TECNICOS` seguem intactos para todos os demais nomes.

## Não alterar
- Lógica de hash e `PALETA_TECNICOS` para os demais técnicos.
- Filtro por técnico, legenda e a distinção de grupo por borda sólida/tracejada.
- Hook `useAgendaOperacoes`, navegação e demais partes da tela.

## Aceite
- Lenilton → laranja suave, Roger → verde suave, Phelipe → lilás suave, tanto nos eventos do calendário quanto na legenda (mesma função alimenta os dois).
- Tons pastéis, legíveis com o texto atual; demais técnicos com as cores que já tinham.

## Validação
- Typecheck + build.
- Playwright: abrir `/agenda-operacoes`, confirmar na legenda/eventos as cores dos três (quando presentes nos dados) e que outros técnicos mantêm a cor do hash.
