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
  ListBullets,
  SquaresFour,
  ChartBar,
  Camera,
  Link,
  Upload,
  Star,
} from '@phosphor-icons/react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../../lib/auth';
import type { Tool } from '../../types';

interface ToolWithStatus extends Tool {
  tried: boolean;
}

type ViewMode = 'timeline' | 'grid' | 'stats';

export default function Tracker() {
  const { user } = useAuth();
  const [tools, setTools] = useState<ToolWithStatus[]>([]);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [proofModal, setProofModal] = useState<number | null>(null);
  const [checkInData, setCheckInData] = useState({ mood: '' as string, accomplishments: '', blockers: '' });
  const [checkInSubmitted, setCheckInSubmitted] = useState(false);
  const [reflectionData, setReflectionData] = useState({
    enjoyed_most: '', hardest_tool: '', built_anything: '', liked_disliked: '', next_week_focus: '',
  });
  const [reflectionInsights, setReflectionInsights] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'tried' | 'untried'>('all');

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
          setTools(data.tools.map((t: Tool) => ({ ...t, tried: triedIds.includes(t.id) })));
        }
      } catch { /* fallback */ } finally { setLoading(false); }
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
    if (typeof window !== 'undefined') localStorage.setItem('triedTools', JSON.stringify(newTriedTools));
    if (user?.id) {
      fetch('/api/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, tool_id: toolId, status: newTriedTools.includes(toolId) ? 'tried' : 'suggested' }),
      }).catch(() => {});
    }
  };

  const handleCheckIn = async () => {
    if (!checkInData.mood || !checkInData.accomplishments) return;
    try {
      await fetch('/api/check-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id || 'local-user', mood: checkInData.mood, tools_used: triedTools, accomplishments: checkInData.accomplishments, blockers: checkInData.blockers }),
      });
    } catch { /* saved locally */ }
    setCheckInSubmitted(true);
    setTimeout(() => { setCheckInOpen(false); setCheckInSubmitted(false); setCheckInData({ mood: '', accomplishments: '', blockers: '' }); }, 2000);
  };

  const handleReflection = async () => {
    try {
      const res = await fetch('/api/reflection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id || 'local-user', ...reflectionData, tools_mastered: triedTools }),
      });
      const data = await res.json();
      if (data.insights) setReflectionInsights(data.insights);
    } catch { setReflectionInsights('Great job reflecting on your week!'); }
  };

  const handleProofSubmit = async (toolId: number) => {
    if (!proofUrl) return;
    try {
      const formData = new FormData();
      formData.append('user_id', user?.id || 'local-user');
      formData.append('tool_id', String(toolId));
      formData.append('proof_type', 'link');
      formData.append('proof_url', proofUrl);
      await fetch('/api/proof', { method: 'POST', body: formData });
    } catch { /* silent */ }
    setProofModal(null);
    setProofUrl('');
  };

  const triedCount = triedTools.length;
  const totalCount = tools.length;
  const progressPercent = totalCount > 0 ? Math.round((triedCount / totalCount) * 100) : 0;
  const categories = [...new Set(tools.map(t => t.category))];
  const filteredTools = tools.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterStatus === 'tried' && !t.tried) return false;
    if (filterStatus === 'untried' && t.tried) return false;
    return true;
  });

  if (loading) {
    return (<div className="flex w-full h-screen bg-royal"><Sidebar /><main className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phoenix" /></main></div>);
  }

  return (
    <div className="flex w-full h-screen bg-royal fade-in">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto">
        <div className="p-8 lg:p-12 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-serif text-white mb-2">Progress Tracker</h1>
              <p className="text-white/50">Track your AI tool exploration journey</p>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              {([
                { mode: 'timeline' as ViewMode, icon: ListBullets, label: 'Timeline' },
                { mode: 'grid' as ViewMode, icon: SquaresFour, label: 'Grid' },
                { mode: 'stats' as ViewMode, icon: ChartBar, label: 'Stats' },
              ]).map(({ mode, icon: Icon, label }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${viewMode === mode ? 'bg-phoenix text-white' : 'text-white/50 hover:text-white'}`}>
                  <Icon size={14} /><span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-chartreuse/20 flex items-center justify-center"><Lightning size={18} className="text-chartreuse" weight="fill" /></div>
                <span className="text-sm text-white/60">Tools Tried</span>
              </div>
              <div className="text-3xl font-bold text-white">{triedCount}<span className="text-lg text-white/40">/{totalCount}</span></div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-phoenix/20 flex items-center justify-center"><Trophy size={18} className="text-phoenix" weight="fill" /></div>
                <span className="text-sm text-white/60">Progress</span>
              </div>
              <div className="text-3xl font-bold text-white">{progressPercent}%</div>
              <div className="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-phoenix rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-lavender/20 flex items-center justify-center"><Target size={18} className="text-lavender" weight="fill" /></div>
                <span className="text-sm text-white/60">Weekly Goal</span>
              </div>
              <p className="text-sm text-white/80 italic">{userProfile?.goal || 'Set a goal in settings'}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none appearance-none">
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'tried' | 'untried')} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none appearance-none">
              <option value="all">All Status</option>
              <option value="tried">Tried</option>
              <option value="untried">Not Tried</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-8">
            <button onClick={() => { setCheckInOpen(!checkInOpen); setReflectionOpen(false); }} className="flex items-center gap-2 px-5 py-2.5 bg-chartreuse/10 border border-chartreuse/20 rounded-xl hover:bg-chartreuse/15 transition-colors text-white text-sm font-medium">
              <CalendarCheck size={18} className="text-chartreuse" /> Daily Check-in
            </button>
            <button onClick={() => { setReflectionOpen(!reflectionOpen); setCheckInOpen(false); }} className="flex items-center gap-2 px-5 py-2.5 bg-phoenix/10 border border-phoenix/20 rounded-xl hover:bg-phoenix/15 transition-colors text-white text-sm font-medium">
              <Star size={18} className="text-phoenix" /> Weekly Reflection
            </button>
          </div>

          {/* Check-in Panel */}
          {checkInOpen && (
            <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              {checkInSubmitted ? (
                <div className="text-center py-6"><CheckCircle size={40} className="text-chartreuse mx-auto mb-2" weight="fill" /><p className="text-white font-medium">Check-in saved!</p></div>
              ) : (<>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">How are you feeling?</label>
                  <div className="flex gap-2">
                    {(['great', 'good', 'okay', 'struggling'] as const).map(mood => (
                      <button key={mood} onClick={() => setCheckInData(prev => ({ ...prev, mood }))}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${checkInData.mood === mood ? 'bg-chartreuse text-royal' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{mood}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">What did you accomplish?</label>
                  <textarea value={checkInData.accomplishments} onChange={(e) => setCheckInData(prev => ({ ...prev, accomplishments: e.target.value }))} placeholder="e.g., Tried KREA AI, created 3 designs..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-chartreuse/50 resize-none min-h-[70px]" />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Any blockers?</label>
                  <textarea value={checkInData.blockers} onChange={(e) => setCheckInData(prev => ({ ...prev, blockers: e.target.value }))} placeholder="e.g., Couldn't figure out export..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-chartreuse/50 resize-none min-h-[50px]" />
                </div>
                <button onClick={handleCheckIn} disabled={!checkInData.mood || !checkInData.accomplishments}
                  className="px-5 py-2.5 bg-chartreuse text-royal font-medium rounded-xl hover:bg-chartreuse/90 transition-colors disabled:opacity-40">Submit Check-in</button>
              </>)}
            </div>
          )}

          {/* Reflection Panel */}
          {reflectionOpen && (
            <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Weekly Reflection</h3>
              {[
                { key: 'enjoyed_most', label: 'Which tool did you enjoy most? Why?', placeholder: 'e.g., KREA AI because the real-time canvas was magical...' },
                { key: 'hardest_tool', label: 'Which tool was hardest?', placeholder: 'e.g., Descript had a steep learning curve...' },
                { key: 'built_anything', label: 'Did you build anything?', placeholder: 'e.g., A landing page with Relume...' },
                { key: 'liked_disliked', label: 'What features did you like/dislike?', placeholder: 'e.g., Loved AI layouts, disliked limited exports...' },
                { key: 'next_week_focus', label: 'Next week focus?', placeholder: 'e.g., Try more video tools...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm text-white/60 mb-2 block">{label}</label>
                  <textarea value={reflectionData[key as keyof typeof reflectionData]} onChange={(e) => setReflectionData(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-phoenix/50 resize-none min-h-[50px]" />
                </div>
              ))}
              <button onClick={handleReflection} className="px-5 py-2.5 bg-phoenix text-white font-medium rounded-xl hover:bg-phoenix/90 transition-colors">Submit Reflection</button>
              {reflectionInsights && (
                <div className="mt-4 p-4 bg-phoenix/10 border border-phoenix/20 rounded-xl">
                  <h4 className="text-sm font-semibold text-phoenix mb-2">AI Insights</h4>
                  <p className="text-sm text-white/70 leading-relaxed">{reflectionInsights}</p>
                </div>
              )}
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-white mb-4">Weekly Tools</h2>
              {filteredTools.map((tool, index) => (
                <div key={tool.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${tool.tried ? 'bg-chartreuse/5 border-chartreuse/20' : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'}`}>
                  <span className="text-xs text-white/30 w-6 text-center font-mono">{String(index + 1).padStart(2, '0')}</span>
                  <button onClick={() => handleToggleTried(tool.id)} className="shrink-0">
                    {tool.tried ? <CheckCircle size={22} className="text-chartreuse" weight="fill" /> : <Circle size={22} className="text-white/30 hover:text-white/60 transition-colors" />}
                  </button>
                  <div className={`w-9 h-9 rounded-xl ${tool.color} flex items-center justify-center shrink-0`}>
                    <span className="text-royal text-[10px] font-bold">{tool.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><h4 className={`font-medium text-sm ${tool.tried ? 'text-chartreuse' : 'text-white'}`}>{tool.name}</h4><span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">{tool.category}</span></div>
                    <p className="text-xs text-white/40 truncate">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setProofModal(tool.id)} className="p-1.5 text-white/30 hover:text-white transition-colors" title="Submit proof"><Camera size={16} /></button>
                    <a href={tool.website} target="_blank" rel="noopener noreferrer" className="p-1.5 text-white/30 hover:text-white transition-colors"><ArrowUpRight size={16} /></a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Tool Gallery</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredTools.map((tool) => (
                  <div key={tool.id} className={`p-4 rounded-2xl border transition-all ${tool.tried ? 'bg-chartreuse/5 border-chartreuse/20' : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'}`}>
                    <div className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center mb-3`}><span className="text-royal text-xs font-bold">{tool.name.substring(0, 2).toUpperCase()}</span></div>
                    <h4 className={`font-medium text-sm mb-1 ${tool.tried ? 'text-chartreuse' : 'text-white'}`}>{tool.name}</h4>
                    <p className="text-[10px] text-white/40 mb-2 line-clamp-2">{tool.description}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">{tool.category}</span>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => handleToggleTried(tool.id)} className={`text-[10px] px-2 py-1 rounded-lg font-medium ${tool.tried ? 'bg-chartreuse/20 text-chartreuse' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>{tool.tried ? 'Tried' : 'Mark Tried'}</button>
                      <a href={tool.website} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white"><ArrowUpRight size={14} /></a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats View */}
          {viewMode === 'stats' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white mb-4">Statistics</h2>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white/60 mb-4">By Category</h3>
                <div className="space-y-3">
                  {categories.map(cat => {
                    const catTools = tools.filter(t => t.category === cat);
                    const catTried = catTools.filter(t => t.tried).length;
                    const catPercent = catTools.length > 0 ? Math.round((catTried / catTools.length) * 100) : 0;
                    return (<div key={cat}><div className="flex justify-between items-center mb-1"><span className="text-sm text-white/70">{cat}</span><span className="text-xs text-white/40">{catTried}/{catTools.length}</span></div><div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-chartreuse rounded-full transition-all duration-500" style={{ width: `${catPercent}%` }} /></div></div>);
                  })}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white/60 mb-4">Activity Heatmap</h3>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }).map((_, i) => {
                    const intensity = i < triedCount * 3 ? Math.min(1, (i / (triedCount * 3))) : 0.1;
                    return (<div key={i} className="aspect-square rounded-md" style={{ backgroundColor: `rgba(192, 255, 104, ${intensity})` }} />);
                  })}
                </div>
                <p className="text-xs text-white/40 mt-3">4-week activity heatmap</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center"><div className="text-3xl font-bold text-chartreuse">{triedCount}</div><div className="text-xs text-white/40 mt-1">Tools explored</div></div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center"><div className="text-3xl font-bold text-phoenix">{totalCount - triedCount}</div><div className="text-xs text-white/40 mt-1">Left to try</div></div>
              </div>
            </div>
          )}

          {/* Proof Modal */}
          {proofModal !== null && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setProofModal(null)}>
              <div className="bg-royal border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-white mb-4">Submit Proof</h3>
                <p className="text-sm text-white/50 mb-4">Share a link to your work (screenshot URL, project link, or video)</p>
                <div className="flex items-center gap-2 mb-4">
                  <Link size={16} className="text-white/40" />
                  <input type="url" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-phoenix/50" />
                </div>
                <div className="flex gap-2 text-xs text-white/40 mb-3">
                  <span className="flex items-center gap-1"><Camera size={12} /> Screenshot</span>
                  <span className="flex items-center gap-1"><Link size={12} /> Link</span>
                  <span className="flex items-center gap-1"><Upload size={12} /> Video</span>
                </div>
                <p className="text-xs text-phoenix/70 bg-phoenix/10 border border-phoenix/20 rounded-lg px-3 py-2 mb-4">Proof links and uploads are publicly accessible. Avoid sharing personal information if you prefer to stay anonymous.</p>
                <div className="flex gap-2">
                  <button onClick={() => handleProofSubmit(proofModal)} disabled={!proofUrl} className="px-4 py-2 bg-chartreuse text-royal font-medium rounded-lg text-sm hover:bg-chartreuse/90 disabled:opacity-40">Submit Proof</button>
                  <button onClick={() => setProofModal(null)} className="px-4 py-2 bg-white/5 text-white/60 rounded-lg text-sm hover:bg-white/10">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
