import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AnexoPreviewState } from "@/hooks/useAnexoPreview";

interface AnexoPreviewDialogProps {
  preview: AnexoPreviewState | null;
  onClose: () => void;
  description?: string;
}

export default function AnexoPreviewDialog({ preview, onClose, description }: AnexoPreviewDialogProps) {
  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{preview?.path.split('/').pop()}</DialogTitle>
          <DialogDescription>{description || 'Pré-visualização do e-mail de venda anexado.'}</DialogDescription>
        </DialogHeader>
        {preview?.isImage ? (
          <img
            src={preview.url}
            alt="E-mail de venda"
            className="max-h-[60vh] w-full rounded-md object-contain"
          />
        ) : (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Este arquivo não pode ser exibido aqui. Abra em outra guia para visualizá-lo.
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => preview && window.open(preview.url, '_blank', 'noopener')}
          >
            Abrir em outra guia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
