## Objetivo
Adicionar a exibição da data de `end_time` na aba "Concluídas" (`activeTab === 'concluidas'`) da tela de Ordens de Serviço, sem afetar outras abas ou colunas existentes.

## Mudanças

### 1. Desktop — cabeçalho da tabela
No `<TableHeader>` (linha ~465-474), inserir um novo `<TableHead>Finalizado</TableHead>` imediatamente após o `<TableHead>Data`. Renderizar apenas quando `activeTab === 'concluidas'`.

### 2. Desktop — célula de dados
No `<TableBody>` (linha ~477-550), para cada `<TableRow>`, inserir um `<TableCell>` logo após a célula que exibe `os.created_at`. O conteúdo será:
- Se `os.end_time` existir: `format(new Date(os.end_time), "dd/MM/yy HH:mm", { locale: ptBR })`
- Se `null`: `"-"`
Renderizar apenas quando `activeTab === 'concluidas'`.

### 3. Mobile — cards
Nos cards mobile (linha ~556-624), adicionar abaixo da linha que exibe a data de criação (`os.created_at` formatado como `dd/MM/yy`) uma nova linha com:
- Label: `"Finalizado:"`
- Valor: `format(new Date(os.end_time), "dd/MM/yy", { locale: ptBR })`
Renderizar apenas quando `activeTab === 'concluidas'` e `os.end_time` não for `null`. Se `null`, não exibir a linha.