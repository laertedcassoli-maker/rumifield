import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mic, Square, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Teste = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Gravação iniciada");
    } catch (error) {
      console.error("Erro ao acessar microfone:", error);
      toast.error("Erro ao acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Gravação finalizada");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      toast.success(`Arquivo "${file.name}" carregado`);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) {
      toast.error("Nenhum áudio para transcrever");
      return;
    }

    setIsTranscribing(true);
    setTranscription("");

    try {
      // Convert blob to base64 in chunks to avoid stack overflow
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Process in chunks to avoid "Maximum call stack size exceeded"
      const chunkSize = 8192;
      let base64Audio = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        base64Audio += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64Audio = btoa(base64Audio);

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio }
      });

      if (error) {
        throw error;
      }

      if (data?.transcription) {
        setTranscription(data.transcription);
        toast.success("Transcrição concluída!");
      } else {
        throw new Error("Nenhuma transcrição retornada");
      }
    } catch (error) {
      console.error("Erro na transcrição:", error);
      toast.error("Erro ao transcrever o áudio");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Teste de Transcrição</h1>
        <p className="text-muted-foreground mt-1">
          Grave ou envie um áudio para transcrever usando IA
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gravação de Áudio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Gravar Áudio
            </CardTitle>
            <CardDescription>
              Clique para gravar diretamente do microfone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {!isRecording ? (
                <Button onClick={startRecording} className="flex-1">
                  <Mic className="mr-2 h-4 w-4" />
                  Iniciar Gravação
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive" className="flex-1">
                  <Square className="mr-2 h-4 w-4" />
                  Parar Gravação
                </Button>
              )}
            </div>

            {isRecording && (
              <div className="flex items-center gap-2 text-destructive">
                <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                Gravando...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload de Arquivo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Enviar Arquivo
            </CardTitle>
            <CardDescription>
              Selecione um arquivo de áudio do seu dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar Arquivo
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status e Transcrição */}
      <Card>
        <CardHeader>
          <CardTitle>Transcrição</CardTitle>
          <CardDescription>
            {audioBlob 
              ? `Áudio pronto (${(audioBlob.size / 1024).toFixed(1)} KB)` 
              : "Nenhum áudio selecionado"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={transcribeAudio} 
            disabled={!audioBlob || isTranscribing}
            className="w-full"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transcrevendo...
              </>
            ) : (
              "Transcrever Áudio"
            )}
          </Button>

          {transcription && (
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2">Resultado:</h4>
              <p className="text-foreground whitespace-pre-wrap">{transcription}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Teste;
