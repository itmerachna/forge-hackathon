'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FireSimple, EnvelopeSimple, Lock, ArrowRight, SpinnerGap } from '@phosphor-icons/react';
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
    console.log('[Forge Debug] Starting signup for:', email);

    try {
      console.log('[Forge Debug] Calling signUp...');
      const result = await signUp(email, password);
      console.log('[Forge Debug] signUp returned:', JSON.stringify({ error: result.error?.message, hasSession: !!result.session }));

      if (result.error) {
        console.log('[Forge Debug] SignUp error:', result.error.message);
        setError(result.error.message);
        setLoading(false);
        return;
      }

      if (!result.session) {
        // No session + no error = email already exists (Supabase hides this for security)
        setError('This email is already registered. Please sign in instead.');
        setLoading(false);
        return;
      }

      console.log('[Forge Debug] Session exists, redirecting to profile-setup');
      router.push('/auth/profile-setup');
    } catch (err) {
      console.error('[Forge Debug] Caught exception:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-royal flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2 text-2xl font-serif italic font-bold text-white">
        <div className="w-8 h-8 rounded-full bg-phoenix flex items-center justify-center text-royal">
          <FireSimple size={20} weight="fill" />
        </div>
        Forge.
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        {confirmationSent ? (
          <div className="text-center py-4">
            <EnvelopeSimple size={48} className="text-phoenix mx-auto mb-4" />
            <h1 className="text-2xl font-serif text-white mb-2">Check your email</h1>
            <p className="text-magnolia/60 mb-6">
              We sent a confirmation link to <span className="text-white font-medium">{email}</span>. Click the link to activate your account, then come back and sign in.
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
        <h1 className="text-2xl font-serif text-white mb-2">Create your account</h1>
        <p className="text-magnolia/60 mb-8">Start your AI learning journey with Forge</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-magnolia/60 mb-2">Email</label>
            <div className="relative">
              <EnvelopeSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-magnolia/60 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-magnolia/60 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-phoenix text-white font-medium py-3 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <p className="mt-6 text-center text-magnolia/60 text-sm">
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
