import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'coordenador_rplus' | 'consultor_rplus' | 'coordenador_servicos' | 'coordenador_logistica' | 'tecnico_campo' | 'tecnico_oficina';

interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function logAccess(eventType: 'login' | 'logout' | 'login_denied' | 'login_error', email: string | null, userId: string | null, reason?: string) {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (event === 'SIGNED_IN') {
            setLoading(true);
            setProfile(null);
            setRole(null);
          }
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    // SECURITY NOTE:
    // `cached_profile` / `cached_role` in localStorage are UX HINTS ONLY, used
    // exclusively as a fallback when the device is OFFLINE and the server
    // can't be reached. They are user-writable (any attacker with devtools can
    // set `cached_role = 'admin'`) and MUST NEVER be treated as authoritative.
    //
    // Rules:
    // - When online, role/profile MUST come from Supabase (session/JWT +
    //   user_roles/profiles tables). The cache is written here for later
    //   offline reads, but is never consulted while online.
    // - The cache MUST NOT be the basis for unlocking write actions or
    //   sensitive screens. Real authorization lives in Postgres RLS + the
    //   `has_role()` SECURITY DEFINER function, which the server enforces
    //   regardless of what the client believes its role to be.
    // - If a request fails while offline, we can display cached identity so
    //   the UI doesn't look broken, but any mutation will still be rejected
    //   server-side once connectivity returns.
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).order('role', { ascending: true }).limit(1).maybeSingle()
      ]);

      if (profileRes.error) throw profileRes.error;
      if (roleRes.error) throw roleRes.error;

      if (profileRes.data) {
        const p = profileRes.data as Profile;
        setProfile(p);
        // Cache profile purely as an offline UX hint (display only).
        localStorage.setItem('cached_profile', JSON.stringify(p));
      }
      if (roleRes.data) {
        const r = roleRes.data.role as AppRole;
        setRole(r);
        // Cache role purely as an offline UX hint. Real authorization is RLS.
        localStorage.setItem('cached_role', r);
      } else {
        // Explicitly clear any stale cached role if server says the user has none.
        setRole(null);
        localStorage.removeItem('cached_role');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Only fall back to cached values when we are actually OFFLINE.
      // When online, a failure means we could not confirm the role — we must
      // NOT reuse the cached role (which is user-writable and untrusted).
      if (!isOnline) {
        const cachedProfile = localStorage.getItem('cached_profile');
        const cachedRole = localStorage.getItem('cached_role');
        if (cachedProfile) {
          try { setProfile(JSON.parse(cachedProfile)); } catch {}
        }
        if (cachedRole) {
          // Cached role is a UX hint only; RLS remains the source of truth
          // for anything that mutates data or reads sensitive rows.
          setRole(cachedRole as AppRole);
        }
      } else {
        // Online but the fetch failed — leave role null so the UI stays locked
        // instead of trusting a stale, tamperable cache.
        setRole(null);
      }
    } finally {
      setLoading(false);
    }
  };


  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const RUMINA_DOMAIN = '@rumina.com.br';

    if (!normalizedEmail.endsWith(RUMINA_DOMAIN)) {
      await logAccess('login_denied', normalizedEmail, null, 'Domínio não autorizado');
      return { error: new Error('Apenas contas @rumina.com.br são permitidas.') };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      await logAccess('login_error', normalizedEmail, null, error.message);
      return { error };
    }

    const user = data.user;
    if (!user) {
      await logAccess('login_error', normalizedEmail, null, 'Usuário não retornado após login');
      return { error: new Error('Usuário não retornado após login') };
    }

    const { data: validation, error: vErr } = await supabase.rpc('validate_rumina_login', {
      p_user_id: user.id,
      p_email: normalizedEmail,
    });

    if (vErr) {
      await logAccess('login_error', normalizedEmail, user.id, vErr.message);
      await supabase.auth.signOut({ scope: 'local' });
      return { error: new Error(vErr.message) };
    }

    const allowed = (validation as { allowed: boolean; reason: string | null } | null)?.allowed;
    const reason = (validation as { allowed: boolean; reason: string | null } | null)?.reason ?? null;

    if (!allowed) {
      await logAccess('login_denied', normalizedEmail, user.id, reason ?? 'denied');
      await supabase.auth.signOut({ scope: 'local' });
      return { error: new Error(reason ?? 'Sua conta não tem permissão para acessar.') };
    }

    await logAccess('login', normalizedEmail, user.id, 'password');
    return { error: null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { nome }
      }
    });
    return { error };
  };

  const signOut = async () => {
    const currentEmail = user?.email ?? null;
    const currentId = user?.id ?? null;
    await logAccess('logout', currentEmail, currentId);
    localStorage.removeItem('cached_profile');
    localStorage.removeItem('cached_role');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isAdmin: role === 'admin', loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
