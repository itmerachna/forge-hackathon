'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FireSimple, Camera, User, At, TextAlignLeft, ArrowRight, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../../../lib/auth';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
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
      let avatarUrl = profile?.avatar_url || '';

      // Upload avatar if selected (using base64 for simplicity)
      // In production, you'd upload to Supabase Storage
      if (avatarFile) {
        // For now, store as data URL (works for hackathon, not ideal for production)
        avatarUrl = avatarPreview || '';
      }

      const { error } = await updateProfile({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Go to onboarding
      router.push('/onboarding');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-royal flex items-center justify-center">
        <SpinnerGap className="animate-spin text-phoenix" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-royal flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2 text-2xl font-serif italic font-bold text-white">
        <div className="w-8 h-8 rounded-full bg-phoenix flex items-center justify-center text-royal">
          <FireSimple size={20} weight="fill" />
        </div>
        Forge.
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <h1 className="text-2xl font-serif text-white mb-2">Set up your profile</h1>
        <p className="text-magnolia/60 mb-8">Tell us a bit about yourself</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Avatar */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative w-24 h-24 rounded-full bg-white/10 border-2 border-dashed border-white/20 hover:border-phoenix transition-colors overflow-hidden group"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-6 text-magnolia/40" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={24} className="text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <p className="text-center text-magnolia/40 text-xs">Click to upload photo</p>

          {/* Name */}
          <div>
            <label className="block text-sm text-magnolia/60 mb-2">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="Your name"
                maxLength={50}
                required
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-magnolia/60 mb-2">Username</label>
            <div className="relative">
              <At className="absolute left-3 top-1/2 -translate-y-1/2 text-magnolia/40" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors"
                placeholder="username"
                maxLength={30}
                required
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm text-magnolia/60 mb-2">Bio (optional)</label>
            <div className="relative">
              <TextAlignLeft className="absolute left-3 top-3 text-magnolia/40" size={20} />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-magnolia/30 focus:outline-none focus:border-phoenix transition-colors resize-none"
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={160}
              />
            </div>
            <p className="text-right text-magnolia/40 text-xs mt-1">{bio.length}/160</p>
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
