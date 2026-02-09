'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../../../lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, supabase, loading } = useAuth();
  const [error, setError] = useState('');

  // Handle PKCE code exchange if present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code && supabase) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError('Email confirmation failed. The link may have expired — please sign up again.');
        }
      });
    }
  }, [supabase]);

  // Redirect once authenticated (handles both implicit hash tokens and PKCE)
  useEffect(() => {
    if (!loading && user) {
      router.push('/auth/profile-setup');
    }
  }, [user, loading, router]);

  // Fallback: if auth state hasn't resolved after 8 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!user && !error) {
        setError('Could not confirm your email. The link may have expired.');
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [user, error]);

  if (error) {
    return (
      <div className="h-screen bg-royal flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-400 mb-4">{error}</p>
        <a href="/auth/signup" className="text-phoenix hover:underline">
          Back to Sign Up
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen bg-royal flex flex-col items-center justify-center">
      <SpinnerGap className="animate-spin text-phoenix mb-4" size={40} />
      <p className="text-magnolia/60">Confirming your email...</p>
    </div>
  );
}
