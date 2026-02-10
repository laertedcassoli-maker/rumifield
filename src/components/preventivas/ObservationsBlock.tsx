import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, ChevronUp, ChevronDown, Lock, FileText, Check, Plus, X } from 'lucide-react';
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

// Parse stored notes (newline-separated) into array of lines
const parseNotes = (notes: string | null | undefined): string[] => {
  if (!notes) return [];
  return notes.split('\n').filter(line => line.trim() !== '');
};

// Convert array of lines back to newline-separated string
const serializeNotes = (lines: string[]): string => {
  return lines.filter(line => line.trim() !== '').join('\n');
};

export default function ObservationsBlock({ 
  preventiveId, 
  initialInternalNotes,
  initialPublicNotes,
  isCompleted = false 
}: ObservationsBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalLines, setInternalLines] = useState<string[]>(() => parseNotes(initialInternalNotes));
  const [publicLines, setPublicLines] = useState<string[]>(() => parseNotes(initialPublicNotes));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  

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
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('idle');
    },
  });

  const debouncedSave = useDebouncedCallback((internal: string[], pub: string[]) => {
    setSaveStatus('saving');
    updateNotesMutation.mutate({ 
      internalNotes: serializeNotes(internal), 
      publicNotes: serializeNotes(pub) 
    });
  }, 800);

  // Internal notes handlers
  const addInternalLine = () => {
    const newLines = [...internalLines, ''];
    setInternalLines(newLines);
  };

  const updateInternalLine = (index: number, value: string) => {
    const newLines = [...internalLines];
    newLines[index] = value;
    setInternalLines(newLines);
    debouncedSave(newLines, publicLines);
  };

  const removeInternalLine = (index: number) => {
    const newLines = internalLines.filter((_, i) => i !== index);
    setInternalLines(newLines);
    debouncedSave(newLines, publicLines);
  };

  // Public notes handlers
  const addPublicLine = () => {
    const newLines = [...publicLines, ''];
    setPublicLines(newLines);
  };

  const updatePublicLine = (index: number, value: string) => {
    const newLines = [...publicLines];
    newLines[index] = value;
    setPublicLines(newLines);
    debouncedSave(internalLines, newLines);
  };

  const removePublicLine = (index: number) => {
    const newLines = publicLines.filter((_, i) => i !== index);
    setPublicLines(newLines);
    debouncedSave(internalLines, newLines);
  };

  const hasContent = internalLines.some(l => l.trim()) || publicLines.some(l => l.trim());
  const totalLines = internalLines.filter(l => l.trim()).length + publicLines.filter(l => l.trim()).length;

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
                    {totalLines}
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Observação Interna</Label>
                <Badge variant="outline" className="text-xs">Apenas equipe</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Visível apenas para a equipe Rúmina. Não aparece em relatórios.
              </p>
              
              {isCompleted ? (
                internalLines.length > 0 ? (
                  <ul className="space-y-1">
                    {internalLines.map((line, index) => (
                      <li key={index} className="bg-muted/50 rounded px-3 py-2 text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma observação interna</p>
                )
              ) : (
                <div className="space-y-2">
                  {internalLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-5 text-center">{index + 1}.</span>
                      <Input
                        value={line}
                        onChange={(e) => updateInternalLine(index, e.target.value)}
                        placeholder="Digite a observação..."
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeInternalLine(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={addInternalLine}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar linha
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Public Notes Section */}
            <div className="space-y-3">
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
                publicLines.length > 0 ? (
                  <ul className="space-y-1">
                    {publicLines.map((line, index) => (
                      <li key={index} className="bg-muted/50 rounded px-3 py-2 text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma observação para relatório</p>
                )
              ) : (
                <div className="space-y-2">
                  {publicLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm w-5 text-center">{index + 1}.</span>
                      <Input
                        value={line}
                        onChange={(e) => updatePublicLine(index, e.target.value)}
                        placeholder="Digite a observação..."
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removePublicLine(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={addPublicLine}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar linha
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
