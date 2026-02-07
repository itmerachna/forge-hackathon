'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  ArrowLeft,
  Trash,
  Sliders,
  Code,
  Eye,
  PencilSimple,
} from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../../lib/auth';

const FOCUS_OPTIONS = ['Web Design', 'UI/UX Design', 'Frontend Development', 'No-Code Tools', '3D/Motion Design'];
const LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const TIME_OPTIONS = ['1-2 hours', '3-5 hours', '5+ hours'];

type EditorMode = 'simple' | 'advanced';

function profileToMarkdown(profile: Record<string, string>): string {
  return `# My Forge Preferences

## Focus Area
${profile.focus || '_Not set_'}

## Skill Level
${profile.level || '_Not set_'}

## Weekly Time Commitment
${profile.time || '_Not set_'}

## Preferences
${profile.preferences || '_None specified_'}

## Tools I Already Use
${profile.existing_tools || '_None listed_'}

## 4-Week Goal
${profile.goal || '_No goal set_'}
`;
}

function markdownToProfile(md: string): Record<string, string> {
  const profile: Record<string, string> = {
    focus: '',
    level: '',
    time: '',
    preferences: '',
    existing_tools: '',
    goal: '',
  };

  const sections = md.split(/^## /m).slice(1);
  for (const section of sections) {
    const [header, ...content] = section.split('\n');
    const value = content.join('\n').trim().replace(/^_|_$/g, '');

    const headerLower = header.toLowerCase().trim();
    if (headerLower.includes('focus')) profile.focus = value === 'Not set' ? '' : value;
    else if (headerLower.includes('skill')) profile.level = value === 'Not set' ? '' : value;
    else if (headerLower.includes('time') || headerLower.includes('weekly')) profile.time = value === 'Not set' ? '' : value;
    else if (headerLower.includes('preference')) profile.preferences = value === 'None specified' ? '' : value;
    else if (headerLower.includes('tools')) profile.existing_tools = value === 'None listed' ? '' : value;
    else if (headerLower.includes('goal')) profile.goal = value === 'No goal set' ? '' : value;
  }

  return profile;
}

export default function Settings() {
  const { user } = useAuth();
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
  const [editorMode, setEditorMode] = useState<EditorMode>('simple');
  const [markdownContent, setMarkdownContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const parsed = JSON.parse(stored);
      setProfile(parsed);
      setMarkdownContent(profileToMarkdown(parsed));
    }
  }, []);

  // Sync markdown content when profile changes in simple mode
  useEffect(() => {
    if (editorMode === 'simple') {
      setMarkdownContent(profileToMarkdown(profile));
    }
  }, [profile, editorMode]);

  const handleModeSwitch = (mode: EditorMode) => {
    if (mode === 'simple' && editorMode === 'advanced') {
      const parsed = markdownToProfile(markdownContent);
      setProfile(parsed);
    }
    setEditorMode(mode);
  };

  const previewMarkdown = useMemo(() => {
    if (editorMode === 'advanced') return markdownContent;
    return profileToMarkdown(profile);
  }, [editorMode, markdownContent, profile]);

  const handleSave = async () => {
    const profileToSave = editorMode === 'advanced'
      ? markdownToProfile(markdownContent)
      : profile;

    if (typeof window !== 'undefined') {
      localStorage.setItem('userProfile', JSON.stringify(profileToSave));
    }

    if (user?.id) {
      try {
        await fetch('/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            section: 'Tool Preferences',
            content: `Updated preferences: Focus=${profileToSave.focus}, Level=${profileToSave.level}, Goal=${profileToSave.goal}`,
          }),
        });
      } catch {
        // Silent fail
      }
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
    const emptyProfile = { focus: '', level: '', time: '', preferences: '', existing_tools: '', goal: '' };
    setProfile(emptyProfile);
    setMarkdownContent(profileToMarkdown(emptyProfile));
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="flex w-full h-screen bg-royal fade-in">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto">
        <div className="p-8 lg:p-12 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <a href="/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm mb-4">
              <ArrowLeft size={16} />
              Back to Dashboard
            </a>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-serif text-white mb-2">Edit Preferences</h1>
                <p className="text-white/50">Update your preferences and profile</p>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => handleModeSwitch('simple')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editorMode === 'simple' ? 'bg-phoenix text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Sliders size={16} />
                  <span className="hidden sm:inline">Simple</span>
                </button>
                <button
                  onClick={() => handleModeSwitch('advanced')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editorMode === 'advanced' ? 'bg-phoenix text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Code size={16} />
                  <span className="hidden sm:inline">Advanced</span>
                </button>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showPreview ? 'bg-chartreuse text-royal' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Eye size={16} />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`grid gap-8 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Editor Panel */}
            <div>
              {editorMode === 'simple' ? (
                <div className="space-y-8">
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

                  <div>
                    <label className="text-sm font-medium text-white/60 mb-3 block">Preferences</label>
                    <textarea
                      value={profile.preferences || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, preferences: e.target.value }))}
                      placeholder="e.g., I prefer free tools, love tools with great tutorials..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[80px]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-white/60 mb-3 block">Tools you already use</label>
                    <textarea
                      value={profile.existing_tools || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, existing_tools: e.target.value }))}
                      placeholder="e.g., Figma, Framer, Midjourney, Runway..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[60px]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-white/60 mb-3 block">Your 4-week goal</label>
                    <textarea
                      value={profile.goal || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, goal: e.target.value }))}
                      placeholder="e.g., Learn 3D design for web projects..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[60px]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <PencilSimple size={16} className="text-white/40" />
                    <label className="text-sm font-medium text-white/60">Edit your preferences as Markdown</label>
                  </div>
                  <textarea
                    value={markdownContent}
                    onChange={(e) => setMarkdownContent(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-6 text-white font-mono text-sm placeholder-white/30 focus:outline-none focus:border-phoenix/50 focus:ring-1 focus:ring-phoenix/50 resize-none min-h-[500px] leading-relaxed"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/10">
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

            {/* Preview Panel */}
            {showPreview && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 overflow-y-auto max-h-[700px]">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                  <Eye size={16} className="text-chartreuse" />
                  <span className="text-sm font-medium text-white/60">Preview</span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-h1:text-2xl prose-h1:font-serif prose-h2:text-base prose-h2:text-phoenix prose-h2:font-semibold">
                  <ReactMarkdown>{previewMarkdown}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
