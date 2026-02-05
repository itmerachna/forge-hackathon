'use client';
import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Circle,
  ArrowUpRight,
  Lightning,
  Trophy,
  Target,
  CalendarCheck,
} from '@phosphor-icons/react';
import Sidebar from '../components/Sidebar';
import type { Tool } from '../../types';

interface ToolWithStatus extends Tool {
  tried: boolean;
}

export default function Tracker() {
  const [tools, setTools] = useState<ToolWithStatus[]>([]);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInData, setCheckInData] = useState({
    mood: '' as string,
    accomplishments: '',
    blockers: '',
  });
  const [checkInSubmitted, setCheckInSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const profile = localStorage.getItem('userProfile');
    if (profile) setUserProfile(JSON.parse(profile));

    const tried = localStorage.getItem('triedTools');
    const triedIds = tried ? JSON.parse(tried) : [];
    setTriedTools(triedIds);

    async function fetchTools() {
      try {
        const res = await fetch('/api/tools');
        const data = await res.json();
        if (data.tools?.length) {
          setTools(data.tools.map((t: Tool) => ({
            ...t,
            tried: triedIds.includes(t.id),
          })));
        }
      } catch {
        // fallback handled by API
      } finally {
        setLoading(false);
      }
    }
    fetchTools();
  }, []);

  const handleToggleTried = (toolId: number) => {
    let newTriedTools: number[];
    if (triedTools.includes(toolId)) {
      newTriedTools = triedTools.filter(id => id !== toolId);
    } else {
      newTriedTools = [...triedTools, toolId];
    }
    setTriedTools(newTriedTools);
    setTools(prev => prev.map(t => ({ ...t, tried: newTriedTools.includes(t.id) })));
    if (typeof window !== 'undefined') {
      localStorage.setItem('triedTools', JSON.stringify(newTriedTools));
    }

    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'local-user',
        tool_id: toolId,
        status: newTriedTools.includes(toolId) ? 'tried' : 'suggested',
      }),
    }).catch(() => {});
  };

  const handleCheckIn = async () => {
    if (!checkInData.mood || !checkInData.accomplishments) return;

    try {
      await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'local-user',
          mood: checkInData.mood,
          tools_used: triedTools,
          accomplishments: checkInData.accomplishments,
          blockers: checkInData.blockers,
        }),
      });
    } catch {
      // Check-in saved locally
    }

    setCheckInSubmitted(true);
    setTimeout(() => {
      setCheckInOpen(false);
      setCheckInSubmitted(false);
      setCheckInData({ mood: '', accomplishments: '', blockers: '' });
    }, 2000);
  };

  const triedCount = triedTools.length;
  const totalCount = tools.length;
  const progressPercent = totalCount > 0 ? Math.round((triedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex w-full h-screen bg-royal">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phoenix" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-royal fade-in">
      <Sidebar />

      <main className="flex-1 h-full overflow-y-auto">
        <div className="p-8 lg:p-12 max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-serif text-white mb-2">Progress Tracker</h1>
            <p className="text-white/50">Track your AI tool exploration journey</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-chartreuse/20 flex items-center justify-center">
                  <Lightning size={20} className="text-chartreuse" weight="fill" />
                </div>
                <span className="text-sm text-white/60">Tools Tried</span>
              </div>
              <div className="text-3xl font-bold text-white">{triedCount}<span className="text-lg text-white/40">/{totalCount}</span></div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-phoenix/20 flex items-center justify-center">
                  <Trophy size={20} className="text-phoenix" weight="fill" />
                </div>
                <span className="text-sm text-white/60">Progress</span>
              </div>
              <div className="text-3xl font-bold text-white">{progressPercent}%</div>
              <div className="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-phoenix rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-lavender/20 flex items-center justify-center">
                  <Target size={20} className="text-lavender" weight="fill" />
                </div>
                <span className="text-sm text-white/60">Weekly Goal</span>
              </div>
              <p className="text-sm text-white/80 italic">
                {userProfile?.goal || 'Set a goal in settings'}
              </p>
            </div>
          </div>

          {/* Daily Check-in */}
          <div className="mb-10">
            <button
              onClick={() => setCheckInOpen(!checkInOpen)}
              className="w-full flex items-center gap-4 p-6 bg-chartreuse/10 border border-chartreuse/20 rounded-2xl hover:bg-chartreuse/15 transition-colors"
            >
              <CalendarCheck size={24} className="text-chartreuse" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">Daily Check-in</h3>
                <p className="text-sm text-white/50">Reflect on your progress today</p>
              </div>
            </button>

            {checkInOpen && (
              <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                {checkInSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="text-chartreuse mx-auto mb-3" weight="fill" />
                    <p className="text-white font-medium">Check-in saved!</p>
                    <p className="text-white/50 text-sm">Great job staying accountable.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-sm text-white/60 mb-2 block">How are you feeling?</label>
                      <div className="flex gap-3">
                        {(['great', 'good', 'okay', 'struggling'] as const).map(mood => (
                          <button
                            key={mood}
                            onClick={() => setCheckInData(prev => ({ ...prev, mood }))}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
                              checkInData.mood === mood
                                ? 'bg-chartreuse text-royal'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/60 mb-2 block">What did you accomplish?</label>
                      <textarea
                        value={checkInData.accomplishments}
                        onChange={(e) => setCheckInData(prev => ({ ...prev, accomplishments: e.target.value }))}
                        placeholder="e.g., Tried KREA AI for the first time, created 3 designs..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-chartreuse/50 resize-none min-h-[80px]"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-white/60 mb-2 block">Any blockers?</label>
                      <textarea
                        value={checkInData.blockers}
                        onChange={(e) => setCheckInData(prev => ({ ...prev, blockers: e.target.value }))}
                        placeholder="e.g., Couldn't figure out the export feature..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-chartreuse/50 resize-none min-h-[60px]"
                      />
                    </div>

                    <button
                      onClick={handleCheckIn}
                      disabled={!checkInData.mood || !checkInData.accomplishments}
                      className="px-6 py-3 bg-chartreuse text-royal font-medium rounded-xl hover:bg-chartreuse/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Submit Check-in
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tool List */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Weekly Tools</h2>
            <div className="space-y-3">
              {tools.map((tool, index) => (
                <div
                  key={tool.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    tool.tried
                      ? 'bg-chartreuse/5 border-chartreuse/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="text-xs text-white/30 w-6 text-center font-mono">{String(index + 1).padStart(2, '0')}</span>

                  <button
                    onClick={() => handleToggleTried(tool.id)}
                    className="shrink-0"
                  >
                    {tool.tried ? (
                      <CheckCircle size={24} className="text-chartreuse" weight="fill" />
                    ) : (
                      <Circle size={24} className="text-white/30 hover:text-white/60 transition-colors" />
                    )}
                  </button>

                  <div className={`w-10 h-10 rounded-xl ${tool.color} flex items-center justify-center shrink-0`}>
                    <span className="text-royal text-xs font-bold">{tool.name.substring(0, 2).toUpperCase()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${tool.tried ? 'text-chartreuse' : 'text-white'}`}>{tool.name}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{tool.category}</span>
                    </div>
                    <p className="text-sm text-white/40 truncate">{tool.description}</p>
                  </div>

                  <a
                    href={tool.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-white/30 hover:text-white transition-colors shrink-0"
                  >
                    <ArrowUpRight size={18} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
