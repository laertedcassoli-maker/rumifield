import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Loader2, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const RUMINA_DOMAIN = '@rumina.com.br';

async function logAccess(eventType: 'login' | 'login_denied' | 'login_error', email: string | null, userId: string | null, reason?: string) {
  try {
    await supabase.from('access_logs').insert({
      user_id: userId,
      email,
      event_type: eventType,
      reason: reason ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (e) {
    console.warn('[access_logs] failed to insert', e);
  }
}

async function waitForSession(maxAttempts = 5): Promise<{ user: { id: string; email: string | null } } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return { user: { id: session.user.id, email: session.user.email ?? null } };
    }
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return null;
}

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Handle OAuth callback: detect tokens in URL hash, validate via RPC
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hasOauthReturn = hash.includes('access_token') || hash.includes('error') || search.includes('code=');
    if (!hasOauthReturn) return;

    setProcessingCallback(true);

    (async () => {
      try {
        const result = await waitForSession(6);
        if (!result) {
          await logAccess('login_error', null, null, 'Sessão não encontrada após callback OAuth');
          toast({ variant: 'destructive', title: 'Falha no login', description: 'Não foi possível recuperar a sessão. Tente novamente.' });
          setProcessingCallback(false);
          return;
        }

        const { user: u } = result;
        const email = (u.email ?? '').toLowerCase().trim();

        // Validate via RPC
        const { data: validation, error: vErr } = await supabase.rpc('validate_rumina_login', {
          p_user_id: u.id,
          p_email: email,
        });

        if (vErr) {
          await logAccess('login_error', email, u.id, vErr.message);
          await supabase.auth.signOut({ scope: 'local' });
          toast({ variant: 'destructive', title: 'Erro de validação', description: vErr.message });
          setProcessingCallback(false);
          // Clear URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        const allowed = (validation as { allowed: boolean; reason: string | null } | null)?.allowed;
        const reason = (validation as { allowed: boolean; reason: string | null } | null)?.reason ?? null;

        if (!allowed) {
          await logAccess('login_denied', email, u.id, reason ?? 'denied');
          await supabase.auth.signOut({ scope: 'local' });
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: reason ?? 'Sua conta não tem permissão para acessar.',
          });
          setProcessingCallback(false);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // Approved
        await logAccess('login', email, u.id, 'google');
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/', { replace: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logAccess('login_error', null, null, msg);
        toast({ variant: 'destructive', title: 'Erro inesperado', description: msg });
        setProcessingCallback(false);
      }
    })();
  }, [navigate, toast]);

  if (loading || processingCallback) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && !processingCallback) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + '/auth',
        extraParams: { hd: 'rumina.com.br', prompt: 'select_account' },
      });

      if (result.error) {
        await logAccess('login_error', null, null, result.error.message ?? 'oauth_error');
        toast({ variant: 'destructive', title: 'Erro no Google', description: result.error.message ?? 'Falha ao iniciar login.' });
        setIsGoogleLoading(false);
        return;
      }
      // If redirected, browser navigates away — nothing else to do
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logAccess('login_error', null, null, msg);
      toast({ variant: 'destructive', title: 'Erro inesperado', description: msg });
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: result.error.errors[0].message,
      });
      return;
    }

    const emailLc = loginForm.email.trim().toLowerCase();
    if (!emailLc.endsWith(RUMINA_DOMAIN)) {
      await logAccess('login_denied', emailLc, null, 'Domínio não autorizado');
      toast({
        variant: 'destructive',
        title: 'Acesso negado',
        description: 'Apenas contas @rumina.com.br são permitidas.',
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(emailLc, loginForm.password);

    if (error) {
      await logAccess('login_error', emailLc, null, error.message);
      setIsSubmitting(false);
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message,
      });
      return;
    }

    // Validate via RPC after password login as well
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: validation } = await supabase.rpc('validate_rumina_login', {
        p_user_id: session.user.id,
        p_email: emailLc,
      });
      const allowed = (validation as { allowed: boolean; reason: string | null } | null)?.allowed;
      const reason = (validation as { allowed: boolean; reason: string | null } | null)?.reason ?? null;
      if (!allowed) {
        await logAccess('login_denied', emailLc, session.user.id, reason ?? 'denied');
        await supabase.auth.signOut({ scope: 'local' });
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'Acesso negado', description: reason ?? 'Sua conta está inativa.' });
        return;
      }
      await logAccess('login', emailLc, session.user.id, 'password');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Play className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">RumiField</CardTitle>
          <CardDescription>Acesso restrito a @rumina.com.br</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </>
            )}
          </Button>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
              Outras formas de entrar
              <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="seu@rumina.com.br"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
                </Button>
              </form>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
