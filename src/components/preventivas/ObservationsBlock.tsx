import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, ChevronUp, ChevronDown, Lock, FileText, Check } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/hooks/useDebounce';

interface ObservationsBlockProps {
  preventiveId: string;
  initialInternalNotes?: string | null;
  initialPublicNotes?: string | null;
  isCompleted?: boolean;
}

export default function ObservationsBlock({ 
  preventiveId, 
  initialInternalNotes,
  initialPublicNotes,
  isCompleted = false 
}: ObservationsBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalNotes, setInternalNotes] = useState(initialInternalNotes || '');
  const [publicNotes, setPublicNotes] = useState(initialPublicNotes || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const queryClient = useQueryClient();

  // Sync with external value changes
  useEffect(() => {
    if (initialInternalNotes !== undefined) {
      setInternalNotes(initialInternalNotes || '');
    }
    if (initialPublicNotes !== undefined) {
      setPublicNotes(initialPublicNotes || '');
    }
  }, [initialInternalNotes, initialPublicNotes]);

  const updateNotesMutation = useMutation({
    mutationFn: async ({ internalNotes, publicNotes }: { internalNotes: string; publicNotes: string }) => {
      const { error } = await supabase
        .from('preventive_maintenance')
        .update({ 
          internal_notes: internalNotes || null,
          public_notes: publicNotes || null
        })
        .eq('id', preventiveId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-item-attendance'] });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('idle');
    },
  });

  const debouncedSave = useDebouncedCallback((internal: string, pub: string) => {
    setSaveStatus('saving');
    updateNotesMutation.mutate({ internalNotes: internal, publicNotes: pub });
  }, 800);

  const handleInternalChange = (value: string) => {
    setInternalNotes(value);
    debouncedSave(value, publicNotes);
  };

  const handlePublicChange = (value: string) => {
    setPublicNotes(value);
    debouncedSave(internalNotes, value);
  };

  const hasContent = !!(internalNotes || publicNotes);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Observações</CardTitle>
                {hasContent && (
                  <Badge variant="secondary" className="ml-1">
                    {[internalNotes, publicNotes].filter(Boolean).length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {saveStatus === 'saving' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {saveStatus === 'saved' && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
          <CardContent className="pt-0 space-y-4">
            {/* Internal Notes Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Observação Interna</Label>
                <Badge variant="outline" className="text-xs">Apenas equipe</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Visível apenas para a equipe Rúmina. Não aparece em relatórios.
              </p>
              {isCompleted ? (
                internalNotes ? (
                  <div className="bg-muted/50 rounded p-3 text-sm whitespace-pre-wrap">
                    {internalNotes}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma observação interna</p>
                )
              ) : (
                <Textarea
                  value={internalNotes}
                  onChange={(e) => handleInternalChange(e.target.value)}
                  placeholder="Anotações internas sobre a visita..."
                  className={cn("min-h-[80px] resize-none text-sm overflow-hidden")}
                  rows={3}
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              )}
            </div>

            <Separator />

            {/* Public Notes Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Observação para Relatório</Label>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                  Produtor
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Será exibida no relatório enviado ao produtor.
              </p>
              {isCompleted ? (
                publicNotes ? (
                  <div className="bg-muted/50 rounded p-3 text-sm whitespace-pre-wrap">
                    {publicNotes}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma observação para relatório</p>
                )
              ) : (
                <Textarea
                  value={publicNotes}
                  onChange={(e) => handlePublicChange(e.target.value)}
                  placeholder="Observações para o produtor ver no relatório..."
                  className={cn("min-h-[80px] resize-none text-sm overflow-hidden")}
                  rows={3}
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
