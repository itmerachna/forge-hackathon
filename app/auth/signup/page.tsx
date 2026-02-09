'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { EnvelopeSimple, Lock, ArrowRight, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../../../lib/auth';

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Attempt signup — retry once on timeout (Supabase free tier can pause and take 60s+ to resume)
      let result: Awaited<ReturnType<typeof signUp>> | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const timeoutMs = attempt === 0 ? 30000 : 45000;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
          );
          result = await Promise.race([signUp(email, password), timeoutPromise]);
          break; // Success — exit retry loop
        } catch (err) {
          if (err instanceof Error && err.message === 'TIMEOUT' && attempt === 0) {
            // First timeout — retry automatically (project may be waking up)
            setError('Connecting to server... retrying.');
            continue;
          }
          throw err; // Non-timeout error or second attempt — propagate
        }
      }

      if (!result) {
        setError('Could not reach the server. Please check your connection and try again.');
        return;
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // Supabase returns a user with empty identities for existing emails
      // when email confirmation is enabled (to avoid leaking account existence)
      if (result.user && result.user.identities?.length === 0) {
        setError('This email is already registered. Please sign in instead.');
        return;
      }

      // If session exists, email confirmation is disabled — proceed directly
      if (result.session) {
        router.push('/auth/profile-setup');
        return;
      }

      // No session means email confirmation is required
      setConfirmationSent(true);
    } catch (err) {
      if (err instanceof Error && err.message === 'TIMEOUT') {
        setError('The server is taking too long to respond. Your Supabase project may be paused — check your Supabase dashboard, then try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-royal flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background — matches landing page */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-maiden/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-phoenix/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Logo — matches landing page size */}
      <Link href="/" className="mb-8 relative z-10">
        <Image src="/forge-logo.svg" alt="Forge" width={240} height={96} priority />
      </Link>

      {/* Card */}
      <div className="w-full max-w-[29rem] bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-6 relative z-10">
        {confirmationSent ? (
          <div className="text-center py-4">
            <EnvelopeSimple size={48} className="text-phoenix mx-auto mb-4" />
            <h1 className="text-3xl font-serif text-white mb-2">Check your email</h1>
            <p className="text-magnolia/60 mb-4">
              We sent a confirmation link to <span className="text-white font-medium">{email}</span>. Click the link to activate your account.
            </p>
            <p className="text-magnolia/40 text-xs mb-6">
              Not seeing the email? Check your spam folder. If you still don&apos;t see it, your Supabase project may have email rate limits — try again in a few minutes.
            </p>
            <Link
              href="/auth/login"
              className="inline-block bg-phoenix text-white font-medium px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        ) : (
        <>
        <h1 className="text-3xl font-serif text-white mb-1 text-center">Create your account</h1>
        <p className="text-magnolia/60 mb-6 text-center text-sm">Start your AI learning journey with Forge</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-magnolia/60 mb-1.5">Email</label>
            <div className="relative">
              <EnvelopeSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-magnolia/60 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-magnolia/60 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-phoenix text-white font-medium py-2.5 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <SpinnerGap className="animate-spin" size={20} />
            ) : (
              <>
                Create Account
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-magnolia/60 text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-phoenix hover:underline">
            Sign in
          </Link>
        </p>
        </>
        )}
      </div>
    </div>
  );
}
