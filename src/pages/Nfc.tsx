import { useState, useCallback, useRef } from 'react';
import { Nfc, Copy, Check, XCircle, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

type NfcStatus = 'idle' | 'reading' | 'success' | 'error' | 'unsupported';

interface NdefRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: string;
  encoding?: string;
  lang?: string;
}

interface NfcResult {
  serialNumber?: string;
  records: NdefRecord[];
  timestamp: Date;
}

// Extend Window interface for NDEFReader
declare global {
  interface Window {
    NDEFReader?: new () => NDEFReader;
  }
  
  interface NDEFReader {
    scan(): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
  }
  
  interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: NDEFMessage;
  }
  
  interface NDEFMessage {
    records: NDEFRecordData[];
  }
  
  interface NDEFRecordData {
    recordType: string;
    mediaType?: string;
    id?: DataView;
    data?: DataView;
    encoding?: string;
    lang?: string;
  }
}

export default function NfcPage() {
  const [status, setStatus] = useState<NfcStatus>('idle');
  const [result, setResult] = useState<NfcResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const readerRef = useRef<NDEFReader | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const decodeNdefData = (record: NDEFRecordData): NdefRecord => {
    const decoded: NdefRecord = {
      recordType: record.recordType,
      mediaType: record.mediaType,
    };

    if (record.id) {
      try {
        decoded.id = new TextDecoder().decode(record.id);
      } catch {
        decoded.id = '[binary data]';
      }
    }

    if (record.data) {
      try {
        if (record.recordType === 'text') {
          decoded.data = new TextDecoder().decode(record.data);
          decoded.encoding = record.encoding;
          decoded.lang = record.lang;
        } else if (record.recordType === 'url') {
          decoded.data = new TextDecoder().decode(record.data);
        } else if (record.mediaType?.startsWith('text/')) {
          decoded.data = new TextDecoder().decode(record.data);
        } else {
          // Try to decode as text, fallback to hex
          try {
            const text = new TextDecoder().decode(record.data);
            if (/^[\x20-\x7E\s]*$/.test(text)) {
              decoded.data = text;
            } else {
              decoded.data = Array.from(new Uint8Array(record.data.buffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            }
          } catch {
            decoded.data = '[binary data]';
          }
        }
      } catch {
        decoded.data = '[unable to decode]';
      }
    }

    return decoded;
  };

  const startReading = useCallback(async () => {
    // Check if Web NFC is supported
    if (!('NDEFReader' in window)) {
      setStatus('unsupported');
      return;
    }

    try {
      setStatus('reading');
      setResult(null);
      setErrorMessage('');

      const reader = new window.NDEFReader!();
      readerRef.current = reader;
      abortControllerRef.current = new AbortController();

      await reader.scan();

      reader.onreading = (event: NDEFReadingEvent) => {
        const records = event.message.records.map(decodeNdefData);
        
        setResult({
          serialNumber: event.serialNumber,
          records,
          timestamp: new Date(),
        });
        setStatus('success');
        
        toast({
          title: 'Tag NFC lida com sucesso!',
          description: `UID: ${event.serialNumber || 'N/A'}`,
        });
      };

      reader.onerror = (event: Event) => {
        console.error('NFC read error:', event);
        setErrorMessage('Erro ao ler a tag NFC. Tente novamente.');
        setStatus('error');
      };

    } catch (error) {
      console.error('NFC scan error:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage('Permissão de NFC negada. Por favor, permita o acesso ao NFC nas configurações do navegador.');
        } else if (error.name === 'NotSupportedError') {
          setStatus('unsupported');
          return;
        } else {
          setErrorMessage(`Erro: ${error.message}`);
        }
      } else {
        setErrorMessage('Erro desconhecido ao iniciar leitura NFC.');
      }
      
      setStatus('error');
    }
  }, [toast]);

  const stopReading = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    readerRef.current = null;
    setStatus('idle');
  }, []);

  const copyResult = useCallback(() => {
    if (!result) return;

    const text = JSON.stringify({
      serialNumber: result.serialNumber,
      records: result.records,
      timestamp: result.timestamp.toISOString(),
    }, null, 2);

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({
        title: 'Copiado!',
        description: 'Resultado copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, toast]);

  const getStatusBadge = () => {
    switch (status) {
      case 'idle':
        return <Badge variant="secondary">Aguardando</Badge>;
      case 'reading':
        return <Badge className="bg-blue-500 text-white animate-pulse">Lendo...</Badge>;
      case 'success':
        return <Badge className="bg-green-500 text-white">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'unsupported':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Não suportado</Badge>;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Nfc className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Leitura NFC</CardTitle>
          <CardDescription className="text-base">
            Aproxime a tag/dispositivo do topo do celular e mantenha por 2-3 segundos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            {getStatusBadge()}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={startReading} 
              disabled={status === 'reading'}
              className="flex-1"
              size="lg"
            >
              {status === 'reading' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Lendo...
                </>
              ) : (
                <>
                  <Nfc className="mr-2 h-5 w-5" />
                  Ler NFC
                </>
              )}
            </Button>
            <Button 
              onClick={stopReading} 
              disabled={status !== 'reading'}
              variant="outline"
              size="lg"
            >
              Parar
            </Button>
          </div>

          {/* Unsupported Message */}
          {status === 'unsupported' && (
            <Alert className="border-orange-500/50 bg-orange-500/10">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <AlertTitle>NFC não suportado</AlertTitle>
              <AlertDescription className="space-y-3 mt-2">
                <p>Este dispositivo/navegador não suporta leitura NFC via web.</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Smartphone className="h-4 w-4 mt-0.5 text-green-600" />
                    <div>
                      <strong>Android:</strong> Use Chrome ou Edge atualizado e certifique-se que o NFC está habilitado nas configurações do dispositivo.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Smartphone className="h-4 w-4 mt-0.5 text-blue-600" />
                    <div>
                      <strong>iPhone:</strong> O iOS não suporta Web NFC. É necessário usar um aplicativo nativo.
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {status === 'error' && errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-5 w-5" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Success Result */}
          {status === 'success' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                {/* Serial Number */}
                {result.serialNumber && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">UID/Serial</span>
                    <p className="font-mono text-sm font-medium">{result.serialNumber}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Timestamp</span>
                  <p className="text-sm">{result.timestamp.toLocaleString('pt-BR')}</p>
                </div>

                {/* NDEF Records */}
                {result.records.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      NDEF Records ({result.records.length})
                    </span>
                    <div className="mt-2 space-y-2">
                      {result.records.map((record, index) => (
                        <div key={index} className="p-2 bg-background rounded border text-sm">
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-mono">{record.recordType}</span>
                            
                            {record.mediaType && (
                              <>
                                <span className="text-muted-foreground">Media Type:</span>
                                <span className="font-mono">{record.mediaType}</span>
                              </>
                            )}
                            
                            {record.id && (
                              <>
                                <span className="text-muted-foreground">ID:</span>
                                <span className="font-mono">{record.id}</span>
                              </>
                            )}
                            
                            {record.lang && (
                              <>
                                <span className="text-muted-foreground">Idioma:</span>
                                <span>{record.lang}</span>
                              </>
                            )}
                          </div>
                          
                          {record.data && (
                            <div className="mt-2 pt-2 border-t">
                              <span className="text-xs text-muted-foreground">Dados:</span>
                              <p className="font-mono text-xs break-all mt-1 p-2 bg-muted rounded">
                                {record.data}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.records.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum registro NDEF encontrado na tag.
                  </p>
                )}
              </div>

              {/* Copy Button */}
              <Button 
                onClick={copyResult} 
                variant="outline" 
                className="w-full"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar resultado
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
