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
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).single()
      ]);

      if (profileRes.data) {
        const p = profileRes.data as Profile;
        setProfile(p);
        localStorage.setItem('cached_profile', JSON.stringify(p));
      }
      if (roleRes.data) {
        const r = roleRes.data.role as AppRole;
        setRole(r);
        localStorage.setItem('cached_role', r);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Fallback to cached values when offline
      const cachedProfile = localStorage.getItem('cached_profile');
      const cachedRole = localStorage.getItem('cached_role');
      if (cachedProfile) {
        try { setProfile(JSON.parse(cachedProfile)); } catch {}
      }
      if (cachedRole) {
        setRole(cachedRole as AppRole);
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
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
