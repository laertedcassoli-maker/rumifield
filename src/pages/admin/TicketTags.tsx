import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Loader2, Tag, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

interface TicketTag {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c',
];

export default function TicketTags() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TicketTag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const { data: tags, isLoading } = useQuery({
    queryKey: ['ticket-tags-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_tags')
        .select('*')
        .order('order_index')
        .order('name');
      if (error) throw error;
      return data as TicketTag[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTag) {
        const { error } = await supabase
          .from('ticket_tags')
          .update({ name, color })
          .eq('id', editingTag.id);
        if (error) throw error;
      } else {
        const nextOrder = (tags?.length || 0);
        const { error } = await supabase
          .from('ticket_tags')
          .insert({ name, color, order_index: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-tags-admin'] });
      closeDialog();
      toast({ title: editingTag ? 'Tag atualizada!' : 'Tag criada!' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ticket_tags')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-tags-admin'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: linkError } = await supabase
        .from('ticket_tag_links')
        .delete()
        .eq('tag_id', id);
      if (linkError) throw linkError;

      const { error } = await supabase
        .from('ticket_tags')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-tags-admin'] });
      toast({ title: 'Tag excluída!' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err.message });
    },
  });

  const openNew = () => {
    setEditingTag(null);
    setName('');
    setColor('#3b82f6');
    setDialogOpen(true);
  };

  const openEdit = (tag: TicketTag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTag(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tags de Chamados</h1>
          <p className="text-muted-foreground">Gerencie as tags disponíveis para categorizar chamados</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tag
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !tags?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma tag cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map(tag => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: tag.color, color: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full border"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs text-muted-foreground">{tag.color}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={tag.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({ id: tag.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(tag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Instalação, Manutenção..."
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-8 p-0 border-0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>Preview:</Label>
              <Badge variant="outline" style={{ borderColor: color, color }}>
                {name || 'Tag'}
              </Badge>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!name.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
