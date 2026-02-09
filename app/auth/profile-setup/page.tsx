'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Camera, User, At, TextAlignLeft, ArrowRight, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../../../lib/auth';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, profile, supabase, updateProfile, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signup');
    }
  }, [user, authLoading, router]);

  // Pre-fill from existing profile
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      if (profile.avatar_url) {
        setAvatarPreview(profile.avatar_url);
      }
    }
  }, [profile]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!username.trim()) {
      setError('Please choose a username');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    setLoading(true);

    try {
      const submitProfile = async () => {
        // Check for duplicate username using shared client from context
        if (supabase) {
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', username.trim().toLowerCase())
            .neq('id', user?.id || '')
            .maybeSingle();

          if (existing) {
            throw new Error('Username is already taken. Please choose another.');
          }
        }

        let avatarUrl = profile?.avatar_url || '';

        if (avatarFile) {
          avatarUrl = avatarPreview || '';
        }

        const { error } = await updateProfile({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
        });

        if (error) {
          throw new Error(error.message || 'Failed to save profile. Please try again.');
        }
      };

      // Retry once on timeout (Supabase free tier can pause)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const timeoutMs = attempt === 0 ? 30000 : 45000;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
          );
          await Promise.race([submitProfile(), timeoutPromise]);
          break; // Success
        } catch (err) {
          if (err instanceof Error && err.message === 'TIMEOUT' && attempt === 0) {
            setError('Connecting to server... retrying.');
            continue;
          }
          throw err;
        }
      }

      router.push('/onboarding');
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

  if (authLoading) {
    return (
      <div className="h-screen bg-royal flex items-center justify-center">
        <SpinnerGap className="animate-spin text-phoenix" size={40} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-royal flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background — matches landing page */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-maiden/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-phoenix/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Logo — matches landing page size */}
      <div className="mb-8 relative z-10">
        <Image src="/forge-logo.svg" alt="Forge" width={240} height={96} priority />
      </div>

      {/* Card */}
      <div className="w-full max-w-[29rem] bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-5 relative z-10">
        <h1 className="text-3xl font-serif text-white mb-1 text-center">Set up your profile</h1>
        <p className="text-magnolia/60 mb-4 text-center text-sm">Tell us a bit about yourself</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Avatar */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative w-16 h-16 rounded-full bg-white/10 border-2 border-dashed border-white/20 hover:border-phoenix transition-colors overflow-hidden group"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-4 text-magnolia/40" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={20} className="text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-magnolia/40 text-xs">Click to upload photo</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-magnolia/60 mb-1.5">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="Your name"
                maxLength={50}
                required
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-magnolia/60 mb-1.5">Username</label>
            <div className="relative">
              <At className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="username"
                maxLength={30}
                required
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm text-magnolia/60 mb-1.5">Bio (optional)</label>
            <div className="relative">
              <TextAlignLeft className="absolute left-3 top-3 text-magnolia/40" size={20} />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors resize-none"
                placeholder="Tell us about yourself..."
                rows={2}
                maxLength={160}
              />
            </div>
            <p className="text-right text-magnolia/40 text-xs mt-0.5">{bio.length}/160</p>
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
                Continue to Onboarding
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
