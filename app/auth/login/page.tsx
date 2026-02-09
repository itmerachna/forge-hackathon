'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { EnvelopeSimple, Lock, ArrowRight, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 30s timeout — Supabase free tier can take 20s+ to wake from sleep
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again in a moment.')), 30000)
      );

      const result = await Promise.race([signIn(email, password), timeoutPromise]);

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // Redirect to dashboard (profile check happens in dashboard)
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-royal flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background — matches landing page */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-maiden/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-phoenix/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Logo */}
      <Link href="/" className="mb-6 relative z-10">
        <Image src="/forge-logo.svg" alt="Forge" width={120} height={48} priority />
      </Link>

      {/* Card */}
      <div className="w-full max-w-[29rem] bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-6 relative z-10">
        <h1 className="text-3xl font-serif text-white mb-1 text-center">Welcome back</h1>
        <p className="text-magnolia/60 mb-6 text-center text-sm">Sign in to continue your learning journey</p>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-phoenix text-white font-medium py-2.5 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <SpinnerGap className="animate-spin" size={20} />
            ) : (
              <>
                Sign In
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-magnolia/60 text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-phoenix hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
