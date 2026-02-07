import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

interface Props {
  clientId: string;
  clientName: string;
}

export function ClienteAnaliseIA({ clientId, clientName }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('crm-client-analysis', {
        body: { clientId },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ variant: 'destructive', title: 'Erro', description: data.error });
        return;
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error('AI analysis error:', err);
      toast({ variant: 'destructive', title: 'Erro na análise', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !analysis) {
      handleGenerate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Análise IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-full p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Análise IA — {clientName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-4">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando dados do cliente...</p>
                <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
            )}

            {!loading && analysis && (
              <div className="prose prose-sm max-w-none dark:prose-invert
                prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground
                prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
                prose-ul:my-2 prose-li:my-0.5">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            )}

            {!loading && !analysis && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Clique para gerar a análise</p>
                <Button onClick={handleGenerate} className="gap-1.5">
                  <Sparkles className="h-4 w-4" /> Gerar Análise
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {!loading && analysis && (
          <div className="border-t px-4 py-3 shrink-0 flex justify-between">
            <Button size="sm" variant="outline" onClick={handleGenerate} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Regenerar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
