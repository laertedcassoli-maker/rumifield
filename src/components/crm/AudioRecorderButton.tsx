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
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function AudioRecorderButton({ visitId, productCode, onRecorded }: Props) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);

  // Android/Desktop refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  // iOS Web Audio refs
  const iosStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const iosStartTimeRef = useRef<number>(0);

  const useWebAudioCapture = isIOS();

  // ── iOS: Web Audio API recording ──
  const startIOSRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      iosStreamRef.current = stream;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      audioChunksRef.current = [];
      iosStartTimeRef.current = Date.now();

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setRecording(true);
    } catch (err) {
      console.error('Error accessing microphone (iOS):', err);
      toast({ variant: 'destructive', title: 'Erro ao acessar microfone', description: 'Verifique as permissões do navegador.' });
    }
  }, [toast]);

  const stopIOSRecording = useCallback(async () => {
    setRecording(false);
    setSaving(true);

    try {
      // Disconnect processor
      scriptProcessorRef.current?.disconnect();
      audioContextRef.current?.close();

      // Stop stream tracks
      iosStreamRef.current?.getTracks().forEach(t => t.stop());

      // Concatenate chunks
      const chunks = audioChunksRef.current;
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const samples = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }

      const sampleRate = audioContextRef.current?.sampleRate ?? 44100;
      const wavBuffer = encodeWAV(samples, sampleRate);
      const audioData = new Uint8Array(wavBuffer);
      const durationSeconds = Math.round((Date.now() - iosStartTimeRef.current) / 1000);

      if (audioData.byteLength <= 44) {
        toast({ variant: 'destructive', title: 'Gravação vazia', description: 'Nenhum dado de áudio capturado.' });
        return;
      }

      await offlineDb.crm_visit_audios.add({
        id: crypto.randomUUID(),
        visit_id: visitId,
        product_code: productCode,
        audioData,
        duration_seconds: durationSeconds,
        file_size_bytes: audioData.byteLength,
        mime_type: 'audio/wav',
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
      scriptProcessorRef.current = null;
      audioContextRef.current = null;
      iosStreamRef.current = null;
      audioChunksRef.current = [];
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

  // ── Unified handlers ──
  const handleStart = useWebAudioCapture ? startIOSRecording : startRecording;
  const handleStop = useWebAudioCapture ? stopIOSRecording : stopRecording;

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
        onClick={handleStop}
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
      onClick={handleStart}
      title="Gravar áudio"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
