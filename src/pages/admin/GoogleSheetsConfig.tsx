import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, Search, Copy, Trash2, RefreshCw, Download, Database } from "lucide-react";

interface LogEntry {
  timestamp: string;
  action: string;
  success: boolean;
  message: string;
  range?: string;
}

interface ReadResult {
  timestamp: string;
  range: string;
  values: string[][];
  rows_count: number;
}

interface BoardRuminaData {
  headers: string[];
  rows: string[][];
  rows_count: number;
  cached: boolean;
  timestamp: string;
}

export default function GoogleSheetsConfig() {
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");
  const [spreadsheetTitle, setSpreadsheetTitle] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const [range, setRange] = useState("Sheet1!A1:Z50");
  const [reading, setReading] = useState(false);
  const [readHistory, setReadHistory] = useState<ReadResult[]>([]);
  const [currentData, setCurrentData] = useState<string[][] | null>(null);
  const [currentRange, setCurrentRange] = useState("");

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [boardRuminaStatus, setBoardRuminaStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [boardRuminaData, setBoardRuminaData] = useState<BoardRuminaData | null>(null);
  const [boardRuminaSearch, setBoardRuminaSearch] = useState("");

  const addLog = useCallback((action: string, success: boolean, message: string, range?: string) => {
    setLogs((prev) => [
      { timestamp: new Date().toLocaleString("pt-BR"), action, success, message, range },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-sheets", {
        body: { action: "test" },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setConnectionStatus("connected");
      setSpreadsheetTitle(data.spreadsheet_title || "");
      setSheetNames(data.sheets || []);
      addLog("test", true, `Conectado: "${data.spreadsheet_title}" (${(data.sheets || []).length} abas)`);
      toast({ title: "Conexão OK", description: `Planilha: ${data.spreadsheet_title}` });
    } catch (err: any) {
      setConnectionStatus("error");
      const msg = err?.message || "Erro desconhecido";
      addLog("test", false, msg);
      toast({ title: "Erro na conexão", description: msg, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleReadData = async () => {
    if (!range.trim()) {
      toast({ title: "Range obrigatório", description: "Informe o range da planilha.", variant: "destructive" });
      return;
    }
    setReading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-sheets", {
        body: { action: "read", range: range.trim() },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setCurrentData(data.values || []);
      setCurrentRange(data.range || range);

      const result: ReadResult = {
        timestamp: new Date().toLocaleString("pt-BR"),
        range: data.range || range,
        values: data.values || [],
        rows_count: data.rows_count || 0,
      };
      setReadHistory((prev) => [result, ...prev.slice(0, 4)]);
      addLog("read", true, `${data.rows_count} linhas lidas de "${data.range}"`, data.range);
      toast({ title: "Dados lidos", description: `${data.rows_count} linhas de ${data.range}` });
    } catch (err: any) {
      const msg = err?.message || "Erro desconhecido";
      addLog("read", false, msg, range);
      toast({ title: "Erro ao ler dados", description: msg, variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const handleLoadBoardRumina = async () => {
    setBoardRuminaStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("board-rumina", {
        body: { action: "clientes-ativos" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const result: BoardRuminaData = {
        headers: data.headers || [],
        rows: data.rows || [],
        rows_count: data.rows_count || 0,
        cached: data.cached || false,
        timestamp: new Date().toLocaleString("pt-BR"),
      };
      setBoardRuminaData(result);
      setBoardRuminaStatus("loaded");
      addLog("board-rumina", true, `${result.rows_count} linhas carregadas${result.cached ? " (cache)" : ""}`, "contratosativos");
      toast({ title: "Board Rumina", description: `${result.rows_count} contratos ativos carregados.` });
    } catch (err: any) {
      setBoardRuminaStatus("error");
      const msg = err?.message || "Erro desconhecido";
      addLog("board-rumina", false, msg, "contratosativos");
      toast({ title: "Erro Board Rumina", description: msg, variant: "destructive" });
    }
  };

  const handleCopyBoardRumina = () => {
    if (!boardRuminaData) return;
    const tsv = [boardRuminaData.headers.join("\t"), ...boardRuminaData.rows.map((r) => r.join("\t"))].join("\n");
    navigator.clipboard.writeText(tsv);
    toast({ title: "Copiado!", description: "Dados do Board Rumina copiados." });
  };

  const handleCopyData = () => {
    if (!currentData) return;
    const tsv = currentData.map((row) => row.join("\t")).join("\n");
    navigator.clipboard.writeText(tsv);
    toast({ title: "Copiado!", description: "Dados copiados para a área de transferência." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Google Sheets</h1>
        <p className="text-muted-foreground">Teste e gerencie a conexão com o Google Sheets (somente leitura).</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status da Conexão</CardTitle>
          <CardDescription>Verifique se as credenciais estão configuradas e a planilha está acessível.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {connectionStatus === "idle" && <Badge variant="secondary">Não testado</Badge>}
            {connectionStatus === "connected" && (
              <Badge className="bg-green-600 text-white gap-1">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </Badge>
            )}
            {connectionStatus === "error" && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" /> Erro
              </Badge>
            )}
            {spreadsheetTitle && <span className="text-sm text-muted-foreground">Planilha: {spreadsheetTitle}</span>}
          </div>

          {sheetNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-sm text-muted-foreground mr-1">Abas:</span>
              {sheetNames.map((name) => (
                <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
              ))}
            </div>
          )}

          <Button onClick={handleTestConnection} disabled={testing} size="sm">
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
        </CardContent>
      </Card>

      {/* Range Reader */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consultar Dados</CardTitle>
          <CardDescription>Informe o range (ex: "Sheet1!A1:Z100") e visualize os dados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="Sheet1!A1:Z100"
              className="max-w-md"
            />
            <Button onClick={handleReadData} disabled={reading} size="sm">
              {reading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Ler Dados
            </Button>
            {currentData && (
              <Button onClick={handleCopyData} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" /> Copiar
              </Button>
            )}
          </div>

          {currentData && currentData.length > 0 && (
            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    {currentData[0]?.map((_, ci) => (
                      <TableHead key={ci} className="text-xs min-w-[100px]">
                        Col {ci + 1}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell className="text-xs text-muted-foreground">{ri + 1}</TableCell>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {currentData && currentData.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum dado encontrado no range "{currentRange}".</p>
          )}

          {/* Read History */}
          {readHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Últimas leituras</h3>
              <div className="space-y-1">
                {readHistory.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => {
                      setRange(r.range);
                      setCurrentData(r.values);
                      setCurrentRange(r.range);
                    }}
                  >
                    <span>{r.timestamp}</span>
                    <Badge variant="outline" className="text-xs">{r.range}</Badge>
                    <span>{r.rows_count} linhas</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Board Rumina */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" /> Board Rumina - Contratos Ativos
          </CardTitle>
          <CardDescription>Dados da aba "contratosativos" via edge function board-rumina.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const filteredRows = boardRuminaData
              ? boardRuminaData.rows.filter(row =>
                  !boardRuminaSearch.trim() || row.some(cell => String(cell).toLowerCase().includes(boardRuminaSearch.toLowerCase()))
                )
              : [];
            const isFiltered = boardRuminaSearch.trim().length > 0 && boardRuminaData;

            return (<>
              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleLoadBoardRumina} disabled={boardRuminaStatus === "loading"} size="sm">
                  {boardRuminaStatus === "loading" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Carregar Contratos Ativos
                </Button>
                {boardRuminaData && (
                  <Button onClick={handleCopyBoardRumina} variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" /> Copiar
                  </Button>
                )}
                {boardRuminaData && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={boardRuminaSearch}
                      onChange={(e) => setBoardRuminaSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="pl-8 h-9 w-48"
                    />
                  </div>
                )}
                {boardRuminaStatus === "loaded" && boardRuminaData && (
                  <>
                    <Badge variant={boardRuminaData.cached ? "secondary" : "default"}>
                      {boardRuminaData.cached ? "Cache" : "Fresh"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {isFiltered ? `${filteredRows.length} de ${boardRuminaData.rows_count}` : boardRuminaData.rows_count} linhas · {boardRuminaData.timestamp}
                    </span>
                  </>
                )}
                {boardRuminaStatus === "error" && (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>
                )}
              </div>

          {filteredRows.length > 0 && boardRuminaData && (
            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-xs">#</TableHead>
                    {boardRuminaData.headers.map((h, i) => (
                      <TableHead key={i} className="text-xs min-w-[100px]">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredRows.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell className="text-xs text-muted-foreground">{ri + 1}</TableCell>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {boardRuminaData && filteredRows.length === 0 && boardRuminaStatus === "loaded" && (
            <p className="text-sm text-muted-foreground">
              {isFiltered ? `Nenhum resultado para "${boardRuminaSearch}".` : "Nenhum contrato ativo encontrado."}
            </p>
          )}
            </>);
          })()}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Logs</CardTitle>
            <CardDescription>Últimas tentativas de conexão e leitura.</CardDescription>
          </div>
          {logs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log ainda. Teste a conexão para começar.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs border-b pb-2 last:border-0">
                  {log.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{log.timestamp}</span>
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      {log.range && <span className="text-muted-foreground">{log.range}</span>}
                    </div>
                    <p className="text-foreground mt-0.5 break-all">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
