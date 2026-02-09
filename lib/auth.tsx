'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User } from '../types';

interface AuthContextType {
  user: SupabaseUser | null;
  profile: User | null;
  session: Session | null;
  supabase: SupabaseClient | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null; user: SupabaseUser | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a browser-side Supabase client
function createBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('Supabase not configured');
    return null;
  }

  return createClient(url, key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createBrowserClient());
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isSubscribed = useRef(true);

  // Fetch user profile from our users table
  const fetchProfile = async (userId: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    }

    return data as User | null;
  };

  // Create profile if it doesn't exist — uses upsert to avoid race conditions
  const ensureProfile = async (authUser: SupabaseUser) => {
    if (!supabase) return null;

    const newProfile = {
      id: authUser.id,
      email: authUser.email || '',
      name: '',
      username: '',
      bio: '',
      avatar_url: '',
      onboarding_completed: false,
    };

    // Retry up to 3 times — covers Supabase cold starts and transient failures
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { error } = await supabase
          .from('users')
          .upsert(newProfile, { onConflict: 'id', ignoreDuplicates: true });

        if (error) {
          console.error(`ensureProfile attempt ${attempt + 1} failed:`, error.message);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }

        // Always fetch the latest profile — upsert with ignoreDuplicates
        // doesn't return data when the row already exists
        return await fetchProfile(authUser.id);
      } catch (err) {
        // Swallow AbortError from React StrictMode double-mount
        if (err instanceof Error && err.name === 'AbortError') return null;
        console.error(`ensureProfile attempt ${attempt + 1} threw:`, err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  };

  const refreshProfile = async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    if (isSubscribed.current) {
      setProfile(profileData);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    isSubscribed.current = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isSubscribed.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id) || await ensureProfile(session.user);
        if (isSubscribed.current) {
          setProfile(profileData);
        }
      }

      if (isSubscribed.current) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed.current) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          let profileData = await fetchProfile(session.user.id);
          if (!profileData && event === 'SIGNED_IN' && isSubscribed.current) {
            profileData = await ensureProfile(session.user);
          }
          if (isSubscribed.current) {
            setProfile(profileData);
          }
        } else {
          if (isSubscribed.current) {
            setProfile(null);
          }
        }

        if (isSubscribed.current) {
          setLoading(false);
        }
      }
    );

    return () => {
      isSubscribed.current = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not configured'), session: null, user: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined,
      },
    });
    return { error: error as Error | null, session: data?.session ?? null, user: data?.user ?? null };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not configured') };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userProfile');
      localStorage.removeItem('triedTools');
      localStorage.removeItem('chatMessages');
      window.location.href = '/';
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!supabase || !user) return { error: new Error('Not authenticated') };

    // Use upsert so it works even if ensureProfile failed.
    // Include all required fields with fallbacks so INSERT case succeeds.
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email || '',
        name: profile?.name ?? '',
        username: profile?.username ?? '',
        bio: profile?.bio ?? '',
        avatar_url: profile?.avatar_url ?? '',
        onboarding_completed: profile?.onboarding_completed ?? false,
        ...updates,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      if (error.message?.includes('users_email_key')) {
        return { error: new Error('This email is already associated with another account.') };
      }
      if (error.message?.includes('row-level security') || error.message?.includes('RLS') || error.code === '42501') {
        return { error: new Error('Row Level Security is blocking this operation. Go to Supabase SQL Editor and run: ALTER TABLE users DISABLE ROW LEVEL SECURITY;') };
      }
      return { error: error as Error | null };
    }

    await refreshProfile();
    return { error: null };
  };

  const value = {
    user,
    profile,
    session,
    supabase,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
