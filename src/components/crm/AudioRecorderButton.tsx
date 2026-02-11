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

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPad on iOS 13+ reports as MacIntel with touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

async function estimateDuration(arrayBuffer: ArrayBuffer): Promise<number | null> {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const dur = Math.round(decoded.duration);
    ctx.close();
    return dur;
  } catch {
    return null;
  }
}

export function AudioRecorderButton({ visitId, productCode, onRecorded }: Props) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const useNativeCapture = isIOS();

  // ── iOS: native file input capture ──
  const handleFileCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setSaving(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioData = new Uint8Array(arrayBuffer);

      if (audioData.byteLength === 0) {
        toast({ variant: 'destructive', title: 'Gravação vazia', description: 'Nenhum dado de áudio capturado.' });
        return;
      }

      const durationSeconds = await estimateDuration(arrayBuffer);
      const mimeType = file.type || 'audio/m4a';

      await offlineDb.crm_visit_audios.add({
        id: crypto.randomUUID(),
        visit_id: visitId,
        product_code: productCode,
        audioData,
        duration_seconds: durationSeconds ?? 0,
        file_size_bytes: audioData.byteLength,
        mime_type: mimeType,
        status: 'pending_upload',
        created_at: new Date().toISOString(),
      });

      onRecorded();
      toast({ title: 'Áudio gravado com sucesso!' });
    } catch (err) {
      console.error('Error saving iOS audio:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar áudio' });
    } finally {
      setSaving(false);
    }
  }, [visitId, productCode, onRecorded, toast]);

  // ── Android/Desktop: MediaRecorder ──
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
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setSaving(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
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
            mime_type: mimeType,
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

        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast({ variant: 'destructive', title: 'Erro ao acessar microfone', description: 'Verifique as permissões do navegador.' });
    }
  }, [visitId, productCode, onRecorded, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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

  // ── iOS: render hidden file input + mic button ──
  if (useNativeCapture) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileCapture}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fileInputRef.current?.click()}
          title="Gravar áudio"
        >
          <Mic className="h-4 w-4" />
        </Button>
      </>
    );
  }

  // ── Android/Desktop: MediaRecorder controls ──
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
