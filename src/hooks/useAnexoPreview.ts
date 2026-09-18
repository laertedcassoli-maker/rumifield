import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AnexoPreviewState {
  url: string;
  path: string;
  isImage: boolean;
}

/**
 * Shared attachment preview behaviour (single click = inline preview,
 * double click = new browser tab) backed by a private storage bucket.
 */
export function useAnexoPreview(bucket: string) {
  const [preview, setPreview] = useState<AnexoPreviewState | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) throw error || new Error('Não foi possível abrir o anexo.');
    return data.signedUrl;
  };

  const handleClick = (path: string) => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(async () => {
      clickTimer.current = null;
      try {
        const url = await getSignedUrl(path);
        const isImage = /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(path);
        setPreview({ url, path, isImage });
      } catch (e: any) {
        toast.error('Erro ao abrir anexo: ' + (e?.message || ''));
      }
    }, 260);
  };

  const handleDoubleClick = async (path: string) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    try {
      const url = await getSignedUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast.error('Erro ao abrir anexo: ' + (e?.message || ''));
    }
  };

  return { preview, setPreview, getSignedUrl, handleClick, handleDoubleClick };
}
