import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { Loader2, Upload, ShieldAlert, CheckCircle2, AlertTriangle, Search } from "lucide-react";

interface ResumoOmie {
  processados: number; preenchidos: number; sem_rastreio: number; nao_encontrados: number;
  ambiguos: number; erros: number; restantes: number;
  detalhes: Array<{ pedidoId: string; pedidoCode: string | null; resultado: string; codigo: string | null; mensagem: string }>;
}
const ROTULO: Record<string, string> = {
  preenchido: "Preenchido", ja_tinha_codigo: "Já tinha código", sem_rastreio: "Sem rastreio",
  nao_encontrado: "Não encontrado", ambiguo: "Ambíguo", multiplos_codigos: "Códigos diferentes", erro: "Erro",
};


interface Resumo {
  success: boolean;
  arquivos_processados: number;
  arquivos_com_erro: Array<{ arquivo: string; erro: string }>;
  pares_encontrados: number;
  codigos_preenchidos: number;
  nfs_atualizadas: string[];
  nfs_sem_pedido: string[];
  nfs_ja_preenchidas: string[];
  nfs_ambiguas: string[];
  error?: string;
}

export default function RelatorioCorreios() {
  const { canAccess, isLoading: permsLoading } = useMenuPermissions();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [omieRunning, setOmieRunning] = useState(false);
  const [omieResumo, setOmieResumo] = useState<ResumoOmie | null>(null);

  const handleOmie = async () => {
    setOmieRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-rastreio-omie", { body: { lote: true } });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha na busca");
      setOmieResumo(data as ResumoOmie);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao buscar no Omie", description: e instanceof Error ? e.message : "Erro desconhecido" });
    } finally {
      setOmieRunning(false);
    }
  };

  if (permsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess("admin_cadastros")) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <span className="text-sm text-muted-foreground">
              Você não tem permissão para acessar esta tela.
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleProcess = async () => {
    if (!file) {
      toast({ title: "Selecione um arquivo", description: "Escolha o relatório .htm dos Correios.", variant: "destructive" });
      return;
    }
    if (!/\.html?$/i.test(file.name)) {
      toast({ title: "Arquivo inválido", description: "Envie o arquivo .htm ou .html do relatório.", variant: "destructive" });
      return;
    }

    setProcessing(true);
    setResumo(null);
    const storagePath = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("correios-relatorios")
        .upload(storagePath, file, { contentType: "text/html", upsert: false });

      if (uploadError) {
        throw new Error(`Falha ao enviar o arquivo: ${uploadError.message}`);
      }

      const { data, error } = await supabase.functions.invoke("sync-correios-rastreio", {
        body: { storagePath },
      });

      if (error) throw new Error(error.message || "Falha ao processar o relatório");

      const result = data as Resumo;
      setResumo(result);

      if (result?.success) {
        toast({
          title: "Relatório processado",
          description: `${result.codigos_preenchidos} código(s) de rastreio preenchido(s).`,
        });
      } else {
        toast({
          title: "Não foi possível processar",
          description: result?.error ?? "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const listBlock = (title: string, items: string[]) =>
    items.length > 0 && (
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex flex-wrap gap-1">
          {items.map((nf) => (
            <Badge key={nf} variant="outline" className="font-mono">{nf}</Badge>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Rastreio Correios</h1>
        <p className="text-sm text-muted-foreground">
          Envie o relatório diário dos Correios (.htm) para preencher automaticamente o código de rastreio dos pedidos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviar relatório</CardTitle>
          <CardDescription>
            Baixe o arquivo do e-mail dos Correios e selecione-o abaixo. Códigos já preenchidos nunca são sobrescritos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".htm,.html,text/html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={processing}
          />
          <Button onClick={handleProcess} disabled={processing} className="w-full sm:w-auto">
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {processing ? "Processando..." : "Enviar e processar"}
          </Button>
        </CardContent>
      </Card>

      {resumo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {resumo.success ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              Resumo do processamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Arquivos processados</p>
                <p className="text-xl font-semibold">{resumo.arquivos_processados}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Remessas lidas</p>
                <p className="text-xl font-semibold">{resumo.pares_encontrados}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Códigos preenchidos</p>
                <p className="text-xl font-semibold">{resumo.codigos_preenchidos}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Já tinham código</p>
                <p className="text-xl font-semibold">{resumo.nfs_ja_preenchidas?.length ?? 0}</p>
              </div>
            </div>

            {listBlock("Notas fiscais atualizadas", resumo.nfs_atualizadas ?? [])}
            {listBlock("Notas fiscais sem pedido correspondente", resumo.nfs_sem_pedido ?? [])}
            {listBlock("Casos ambíguos (mais de um pedido com a mesma nota)", resumo.nfs_ambiguas ?? [])}

            {resumo.arquivos_com_erro?.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Itens com erro</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {resumo.arquivos_com_erro.map((e, i) => (
                    <li key={i}>{e.arquivo}: {e.erro}</li>
                  ))}
                </ul>
              </div>
            )}

            {!resumo.success && resumo.error && (
              <p className="text-sm text-destructive">{resumo.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar no Omie</CardTitle>
          <CardDescription>
            Procura o código de rastreio no Omie para até 25 pedidos Correios faturados nos últimos 45 dias e ainda sem código. Roda sozinho às 8h, 13h e 18h.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleOmie} disabled={omieRunning} variant="outline" className="w-full sm:w-auto">
            {omieRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {omieRunning ? "Buscando..." : "Buscar no Omie agora"}
          </Button>
          {omieResumo && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                {([
                  ["Processados", omieResumo.processados],
                  ["Preenchidos", omieResumo.preenchidos],
                  ["Sem rastreio", omieResumo.sem_rastreio],
                  ["Não encontrados", omieResumo.nao_encontrados],
                  ["Ambíguos", omieResumo.ambiguos],
                  ["Erros", omieResumo.erros],
                ] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className="text-xl font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              {omieResumo.restantes > 0 && (
                <p className="text-sm text-muted-foreground">{omieResumo.restantes} pedido(s) ficaram para a próxima execução.</p>
              )}
              {omieResumo.detalhes.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {omieResumo.detalhes.map((d) => (
                    <li key={d.pedidoId} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">{d.pedidoCode}</span>
                      <Badge variant={d.resultado === "preenchido" ? "default" : "outline"}>{ROTULO[d.resultado] ?? d.resultado}</Badge>
                      {d.codigo && <span className="font-mono">{d.codigo}</span>}
                      <span className="min-w-0 text-muted-foreground">{d.mensagem}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
