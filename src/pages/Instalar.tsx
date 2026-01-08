import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, Wifi, WifiOff, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Instalar() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Listen for online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-green-600 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-2xl">RumiField</CardTitle>
          <CardDescription>
            Sistema de gestão de campo para técnicos
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status de conexão */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-orange-500" />
                <span className="text-orange-500">Offline</span>
              </>
            )}
          </div>

          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-medium">App instalado!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                O RumiField está instalado no seu dispositivo e funciona offline.
              </p>
              <Button asChild className="w-full">
                <a href="/">Abrir App</a>
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">
                  Como instalar no iPhone/iPad:
                </h3>
                <ol className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>
                      Toque no botão <Share className="h-4 w-4 inline" /> Compartilhar
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Role para baixo e toque em "Adicionar à Tela de Início"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Toque em "Adicionar"</span>
                  </li>
                </ol>
              </div>
            </div>
          ) : deferredPrompt ? (
            <div className="space-y-4">
              <Button onClick={handleInstallClick} className="w-full" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Instalar App
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Instale o app para usar offline em áreas sem internet
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Use o menu do navegador para instalar o app, ou acesse pelo celular para ver a opção de instalação.
              </p>
              <Button asChild variant="outline" className="w-full">
                <a href="/">Continuar no navegador</a>
              </Button>
            </div>
          )}

          {/* Benefícios */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-sm mb-3">Por que instalar?</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span>Funciona sem internet em áreas rurais</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span>Sincroniza automaticamente quando online</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span>Acesso rápido pela tela inicial</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span>Experiência de app nativo</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
