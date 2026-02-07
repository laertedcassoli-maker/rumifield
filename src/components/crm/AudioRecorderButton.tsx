import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { offlineDb } from '@/lib/offline-db';
import { useToast } from '@/hooks/use-toast';
import type { ProductCode } from '@/hooks/useCrmData';

interface Props {
  visitId: string;
  productCode: ProductCode;
  onRecorded: () => void;
}

export function AudioRecorderButton({ visitId, productCode, onRecorded }: Props) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        console.log('[AudioRecorder] ondataavailable, size:', e.data.size);
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        console.log('[AudioRecorder] onstop, chunks:', chunksRef.current.length, 'total size:', chunksRef.current.reduce((s, c) => s + c.size, 0));
        setSaving(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log('[AudioRecorder] blob size:', blob.size);
          const arrayBuffer = await blob.arrayBuffer();
          const audioData = new Uint8Array(arrayBuffer);
          const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

          if (audioData.byteLength === 0) {
            toast({ variant: 'destructive', title: 'Gravação vazia', description: 'Nenhum dado de áudio capturado. Verifique permissões do microfone.' });
            return;
          }

          await offlineDb.crm_visit_audios.add({
            id: crypto.randomUUID(),
            visit_id: visitId,
            product_code: productCode,
            audioData,
            duration_seconds: durationSeconds,
            file_size_bytes: audioData.byteLength,
            status: 'pending_upload',
            created_at: new Date().toISOString(),
          });

          onRecorded();
          toast({ title: 'Áudio gravado com sucesso!' });
        } catch (err) {
          console.error('Error saving audio:', err);
          toast({ variant: 'destructive', title: 'Erro ao salvar áudio' });
        } finally {
          setSaving(false);
        }

        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(); // No timeslice — all data comes on stop
      setRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast({ variant: 'destructive', title: 'Erro ao acessar microfone', description: 'Verifique as permissões do navegador.' });
    }
  }, [visitId, productCode, onRecorded, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Flush any buffered data before stopping
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData();
      }
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  if (saving) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (recording) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={stopRecording}
        title="Parar gravação"
      >
        <span className="absolute inset-0 rounded-md bg-red-500/20 animate-pulse" />
        <Square className="h-4 w-4 text-red-600" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={startRecording}
      title="Gravar áudio"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
