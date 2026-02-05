'use client';
import { useState, useEffect } from 'react';
import {
  CheckCircle,
  ArrowLeft,
  Trash,
} from '@phosphor-icons/react';
import Sidebar from '../components/Sidebar';

const FOCUS_OPTIONS = ['Web Design', 'UI/UX Design', 'Frontend Development', 'No-Code Tools', '3D/Motion Design'];
const LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const TIME_OPTIONS = ['1-2 hours', '3-5 hours', '5+ hours'];

export default function Settings() {
  const [profile, setProfile] = useState<Record<string, string>>({
    focus: '',
    level: '',
    time: '',
    preferences: '',
    existing_tools: '',
    goal: '',
  });
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      setProfile(JSON.parse(stored));
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userProfile', JSON.stringify(profile));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userProfile');
      localStorage.removeItem('triedTools');
      localStorage.removeItem('chatMessages');
      localStorage.removeItem('overviewChatMessages');
    }
    setProfile({
      focus: '',
      level: '',
      time: '',
      preferences: '',
      existing_tools: '',
      goal: '',
    });
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="flex w-full h-screen bg-royal fade-in">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto">
        <div className="p-8 lg:p-12 max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <a href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm mb-4">
              <ArrowLeft size={16} />
              Back to Dashboard
            </a>
            <h1 className="text-3xl font-serif text-white mb-2">Settings</h1>
            <p className="text-white/50">Update your preferences and profile</p>
          </div>

          {/* Profile Section */}
          <div className="space-y-8">
            {/* Focus Area */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-3 block">What do you primarily work on?</label>
              <div className="flex flex-wrap gap-2">
                {FOCUS_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setProfile(prev => ({ ...prev, focus: option }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      profile.focus === option
                        ? 'bg-phoenix text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Skill Level */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-3 block">Skill level</label>
              <div className="flex gap-2">
                {LEVEL_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setProfile(prev => ({ ...prev, level: option }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      profile.level === option
                        ? 'bg-phoenix text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly Time */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-3 block">Weekly time commitment</label>
              <div className="flex gap-2">
                {TIME_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setProfile(prev => ({ ...prev, time: option }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      profile.time === option
                        ? 'bg-phoenix text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-3 block">Preferences</label>
              <textarea
                value={profile.preferences || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, preferences: e.target.value }))}
                placeholder="e.g., I prefer free tools, love tools with great tutorials..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[80px]"
              />
            </div>

            {/* Existing Tools */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-3 block">Tools you already use</label>
              <textarea
                value={profile.existing_tools || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, existing_tools: e.target.value }))}
                placeholder="e.g., Figma, Framer, Midjourney, Runway..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[60px]"
              />
            </div>

            {/* 4-Week Goal */}
            <div>
              <label className="text-sm font-medium text-white/60 mb-3 block">Your 4-week goal</label>
              <textarea
                value={profile.goal || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, goal: e.target.value }))}
                placeholder="e.g., Learn 3D design for web projects..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[60px]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={handleSave}
                className="px-8 py-3 bg-chartreuse text-royal font-medium rounded-xl hover:bg-chartreuse/90 transition-colors flex items-center gap-2"
              >
                {saved ? (
                  <>
                    <CheckCircle size={18} weight="fill" />
                    Saved!
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>

              <button
                onClick={handleClearData}
                className="px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors flex items-center gap-2 text-sm"
              >
                <Trash size={16} />
                {cleared ? 'Data Cleared!' : 'Reset All Data'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
