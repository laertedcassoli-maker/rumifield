import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

interface Invite {
  id: string;
  email: string;
  nome: string;
  role: string;
  cidade_base: string | null;
  expires_at: string;
  used_at: string | null;
}

export default function AceitarConvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      if (!token) {
        setError('Token inválido');
        setLoading(false);
        return;
      }

      const { data: rows, error: fetchError } = await supabase
        .rpc('get_invite_by_token', { _token: token });

      const data = Array.isArray(rows) ? rows[0] : rows;

      if (fetchError || !data) {
        setError('Convite não encontrado');
        setLoading(false);
        return;
      }

      if (data.used_at) {
        setError('Este convite já foi utilizado');
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError('Este convite expirou');
        setLoading(false);
        return;
      }

      setInvite(data);
      setLoading(false);
    }

    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
      });
      return;
    }

    if (!invite) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('accept-invite', {
        body: { token, password },
      });

      const fnError = (data as { error?: string } | null)?.error;

      if (error || fnError) {
        let message = fnError ?? error?.message ?? 'Não foi possível criar a conta.';

        // Tenta extrair a mensagem/status do corpo da resposta da função
        const ctx = (error as unknown as { context?: Response })?.context;
        let status = ctx?.status;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.clone().json();
            if (body?.error) message = body.error;
          } catch {
            // corpo não é JSON — mantém mensagem atual
          }
        }
        if (!status && fnError === 'Email já cadastrado') status = 409;

        if (status === 409 || message === 'Email já cadastrado') {
          toast({
            variant: 'destructive',
            title: 'Email já cadastrado',
            description: 'Este email já está em uso. Faça login ou recupere sua senha.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro ao criar conta',
            description: message,
          });
        }
        return;
      }

      setSuccess(true);
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Você pode fazer login agora.',
      });

      setTimeout(() => navigate('/auth'), 2000);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: err?.message ?? 'Erro inesperado',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Convite Inválido</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => navigate('/auth')}>
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-xl font-semibold">Conta Criada!</h2>
            <p className="mt-2 text-muted-foreground">
              Redirecionando para a página de login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Bem-vindo, {invite?.nome}!</CardTitle>
          <CardDescription>
            Defina sua senha para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={invite?.email || ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
