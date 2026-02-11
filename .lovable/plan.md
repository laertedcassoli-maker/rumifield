

## Tornar "Relato da Fazenda" o unico campo de texto e obrigatorio

### Arquivo: `src/pages/chamados/NovoChamado.tsx`

### Alteracoes

1. **Remover estado `title`** (linha 67): apagar `const [title, setTitle] = useState('');` -- nao ha mais campo de titulo na interface.

2. **Validacao no `handleSubmit`** (linha ~234): trocar `!title.trim()` por `!description.trim()` e atualizar a mensagem de erro para "Selecione um cliente e preencha o relato da fazenda."

3. **Insert no banco** (linha ~188): como a coluna `title` no banco e NOT NULL, gerar automaticamente a partir do relato:
   ```
   title: description.trim().substring(0, 80)
   ```

4. **Marcar campo como obrigatorio na UI** (linha ~296): trocar o titulo do card de "Relato da Fazenda" para "Relato da Fazenda *" para indicar visualmente que e obrigatorio.

### Resumo

- Nenhum campo "Titulo" existe mais na interface
- "Relato da Fazenda" (description) passa a ser o unico campo de texto e obrigatorio
- O titulo do chamado no banco e gerado automaticamente (primeiros 80 caracteres do relato)
- Nenhuma alteracao em banco de dados ou edge functions

