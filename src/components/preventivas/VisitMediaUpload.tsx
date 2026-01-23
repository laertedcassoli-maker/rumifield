import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  CheckCircle2,
  Trash2,
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VisitMediaUploadProps {
  preventiveId: string;
  isCompleted?: boolean;
  onStatusChange?: (hasMedia: boolean) => void;
}

interface MediaItem {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  caption: string | null;
  created_at: string;
  signedUrl?: string;
}

export default function VisitMediaUpload({ 
  preventiveId, 
  isCompleted = false,
  onStatusChange 
}: VisitMediaUploadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<MediaItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null);

  // Fetch existing media
  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['preventive-media', preventiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preventive_visit_media')
        .select('*')
        .eq('preventive_id', preventiveId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get signed URLs for each item
      const itemsWithUrls: MediaItem[] = await Promise.all(
        (data || []).map(async (item) => {
          const { data: signedData } = await supabase.storage
            .from('preventive-media')
            .createSignedUrl(item.file_path, 3600); // 1 hour expiry

          return {
            ...item,
            signedUrl: signedData?.signedUrl
          };
        })
      );

      return itemsWithUrls;
    },
  });

  // Notify parent when media changes
  const updateParentStatus = (items: MediaItem[]) => {
    onStatusChange?.(items.length > 0);
  };

  // Handle file selection (from camera or gallery)
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} não é uma imagem válida`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} é muito grande (máximo 10MB)`);
          continue;
        }

        // Generate unique file path
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${preventiveId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('preventive-media')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('preventive_visit_media')
          .insert({
            preventive_id: preventiveId,
            user_id: user.id,
            file_path: filePath,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          });

        if (dbError) {
          console.error('DB error:', dbError);
          // Try to clean up the uploaded file
          await supabase.storage.from('preventive-media').remove([filePath]);
          toast.error(`Erro ao salvar ${file.name}`);
          continue;
        }
      }

      // Refresh the list
      await queryClient.invalidateQueries({ queryKey: ['preventive-media', preventiveId] });
      toast.success('Foto(s) enviada(s) com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar foto(s)');
    } finally {
      setUploading(false);
      // Reset input values
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Delete media mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: MediaItem) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('preventive-media')
        .remove([item.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('preventive_visit_media')
        .delete()
        .eq('id', item.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-media', preventiveId] });
      toast.success('Foto excluída');
      setDeleteConfirm(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Erro ao excluir foto');
    },
  });

  const mediaCount = mediaItems.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Fotos da Visita</CardTitle>
          </div>
          {mediaCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {mediaCount} {mediaCount === 1 ? 'foto' : 'fotos'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Buttons */}
        {!isCompleted && (
          <div className="flex gap-2">
            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />

            {/* Camera Button */}
            <Button
              variant="default"
              className="flex-1"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Câmera
            </Button>

            {/* Gallery Button */}
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Galeria
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Media Grid */}
        {!isLoading && mediaItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
              >
                {item.signedUrl ? (
                  <img
                    src={item.signedUrl}
                    alt={item.file_name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setSelectedImage(item)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedImage(item)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  {!isCompleted && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteConfirm(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && mediaItems.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma foto adicionada</p>
            {!isCompleted && (
              <p className="text-xs mt-1">Tire fotos ou selecione da galeria</p>
            )}
          </div>
        )}

        {/* Completed indicator */}
        {isCompleted && mediaCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>{mediaCount} foto(s) registrada(s)</span>
          </div>
        )}
      </CardContent>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-sm font-normal truncate">
              {selectedImage?.file_name}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {selectedImage?.signedUrl && (
              <img
                src={selectedImage.signedUrl}
                alt={selectedImage.file_name}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
