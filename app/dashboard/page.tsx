'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkle,
  CaretDown,
  ArrowUpRight,
  PaperPlaneRight,
  ThumbsUp,
  ThumbsDown,
} from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import Sidebar from '../components/Sidebar';
import type { ChatMessage, Tool } from '../../types';
import { getGreeting, generateId } from '../../lib/utils';
import { useAuth } from '../../lib/auth';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [stashedTools, setStashedTools] = useState<Tool[]>([]);
  const [expandedTool, setExpandedTool] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(generateId());
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, number>>({});

  const handleFeedback = async (messageId: string, score: number, content: string) => {
    setFeedbackGiven(prev => ({ ...prev, [messageId]: score }));
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          message_id: messageId,
          score,
          message_content: content,
        }),
      });
    } catch {
      // Silent fail — feedback is best-effort
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial data
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const localProfile = localStorage.getItem('userProfile');
    const parsedProfile = localProfile ? JSON.parse(localProfile) : null;
    setUserProfile(parsedProfile);

    const tried = localStorage.getItem('triedTools');
    if (tried) setTriedTools(JSON.parse(tried));

    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      setMessages([
        {
          id: generateId(),
          role: 'assistant',
          content: `${getGreeting()} Welcome to Forge! I'm your AI learning coach. I'll help you discover and master AI tools tailored to your interests. What would you like to explore today?`,
        },
      ]);
    }

    setLoading(false);
  }, []);

  // Fetch progress from Supabase
  useEffect(() => {
    if (!user?.id) return;
    async function fetchProgress() {
      try {
        const res = await fetch(`/api/progress?user_id=${user?.id}`);
        const data = await res.json();
        if (data.progress?.length) {
          const triedIds = data.progress
            .filter((p: { status: string }) => ['tried', 'mastered'].includes(p.status))
            .map((p: { tool_id: number }) => p.tool_id);
          setTriedTools(triedIds);
          localStorage.setItem('triedTools', JSON.stringify(triedIds));
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      }
    }
    fetchProgress();
  }, [user?.id]);

  const WEEKLY_TOOL_LIMIT = 5;

  // Fetch tools (5 active per week, rest stashed)
  useEffect(() => {
    async function fetchTools() {
      try {
        const toolsRes = await fetch('/api/tools');
        const toolsData = await toolsRes.json();
        if (toolsData.tools?.length) {
          setTools(toolsData.tools.slice(0, WEEKLY_TOOL_LIMIT));
          setStashedTools(toolsData.tools.slice(WEEKLY_TOOL_LIMIT));
        }

        if (user?.id) {
          const recRes = await fetch(`/api/recommendations?user_id=${user.id}`);
          const recData = await recRes.json();
          if (recData.recommendations?.length) {
            setTools(recData.recommendations.slice(0, WEEKLY_TOOL_LIMIT));
            setStashedTools(recData.recommendations.slice(WEEKLY_TOOL_LIMIT));
          }
        }
      } catch {
        // Tools API failed
      }
    }
    fetchTools();
  }, [user?.id]);

  // Swap a tool from active list with a random one from stash
  const swapTool = (activeToolId: number) => {
    if (stashedTools.length === 0) return;
    const removedTool = tools.find(t => t.id === activeToolId);
    const randomIndex = Math.floor(Math.random() * stashedTools.length);
    const replacement = stashedTools[randomIndex];
    if (!removedTool || !replacement) return;
    setTools(prev => prev.map(t => t.id === activeToolId ? replacement : t));
    setStashedTools(prev => {
      const next = [...prev];
      next.splice(randomIndex, 1);
      return [removedTool, ...next];
    });
    setExpandedTool(null);
  };

  // Fetch chat history from Supabase
  useEffect(() => {
    if (!user?.id) return;
    async function fetchChatHistory() {
      try {
        const res = await fetch(`/api/chat-history?user_id=${user?.id}`);
        const data = await res.json();
        if (data.messages?.length) {
          setMessages(data.messages);
          localStorage.setItem('chatMessages', JSON.stringify(data.messages));
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
    }
    fetchChatHistory();
  }, [user?.id]);

  // Persist messages
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined') {
      const messagesToSave = messages.map(m => ({ ...m, isStreaming: false }));
      localStorage.setItem('chatMessages', JSON.stringify(messagesToSave));

      if (user?.id && !messages.some(m => m.isStreaming)) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          fetch('/api/chat-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, messages: messagesToSave }),
          }).catch(() => {});
        }, 1000);
      }
    }
  }, [messages, user?.id]);

  const handleMarkAsTried = (toolId: number) => {
    if (triedTools.includes(toolId)) return;
    const newTriedTools = [...triedTools, toolId];
    setTriedTools(newTriedTools);
    if (typeof window !== 'undefined') {
      localStorage.setItem('triedTools', JSON.stringify(newTriedTools));
    }
    if (user?.id) {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, tool_id: toolId, status: 'tried' }),
      }).catch(() => {});
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    const assistantMessageId = generateId();

    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: updatedMessages.slice(-20),
          userProfile: userProfile ? {
            user_id: user?.id,
            focus: userProfile.focus,
            skill_level: userProfile.level,
            weekly_hours: userProfile.time,
            preferences: userProfile.preferences,
            existing_tools: userProfile.existing_tools,
            goal: userProfile.goal,
          } : undefined,
          context: tools.length > 0 ? `This week's tools (${tools.length} active, ${stashedTools.length} stashed): ${tools.map(t => `${t.name} (${t.category}, ${t.pricing || 'Unknown pricing'}${triedTools.includes(t.id) ? ', already tried' : ''})`).join(', ')}` : undefined,
          session_id: sessionIdRef.current,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const assistantMessage: ChatMessage = { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true };
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let fullContent = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) {
                    fullContent += parsed.text;
                    setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: fullContent } : msg));
                  }
                } catch { /* skip */ }
              }
            }
          }
          setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg));
        }
      } else {
        const data = await res.json();
        const responseText = data.message || "I'm having trouble responding right now. Please try again.";

        const assistantMessage: ChatMessage = { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true };
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);

        const words = responseText.split(' ');
        let currentContent = '';
        for (let i = 0; i < words.length; i++) {
          currentContent += (i === 0 ? '' : ' ') + words[i];
          setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: currentContent } : msg));
          await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
        }
        setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setIsTyping(false);
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: "I'm having trouble connecting right now. Please try again in a moment." }]);
    }
  }, [isTyping, messages, userProfile, user?.id, tools, stashedTools, triedTools]);

  const handleSendMessage = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  // Auto daily check-in & weekly reminders
  const autoMessageSentRef = useRef(false);
  useEffect(() => {
    if (loading || isTyping || autoMessageSentRef.current) return;
    if (messages.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const lastCheckIn = localStorage.getItem('lastCheckInDate');
    if (lastCheckIn === today) return;

    autoMessageSentRef.current = true;
    localStorage.setItem('lastCheckInDate', today);

    // Calculate days until week ends (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    const firstName = profile?.name?.split(' ')[0] || 'there';

    let autoMessage: string;

    if (daysUntilSunday === 0) {
      // End of week — reflection prompt
      autoMessage = `Hey ${firstName}, another week wraps up! Take a moment to reflect — what clicked for you this week? What felt challenging? Writing it down helps lock in what you've learned and sets you up for an even better next week.`;
    } else if (daysUntilSunday <= 3) {
      // Countdown reminders (3, 2, or 1 days left)
      const dayWord = daysUntilSunday === 1 ? 'day' : 'days';
      autoMessage = `Hey ${firstName}, you've got ${daysUntilSunday} ${dayWord} left this week to hit your goals. How's it going — anything I can help you knock out today?`;
    } else {
      // Regular daily check-in
      autoMessage = `Welcome back, ${firstName}! Ready to pick up where you left off? Let me know what you'd like to focus on today.`;
    }

    // Small delay so it feels natural after page load
    const timer = setTimeout(() => {
      const checkInMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: autoMessage,
      };
      setMessages(prev => [...prev, checkInMessage]);
    }, 1500);

    return () => clearTimeout(timer);
  }, [loading, isTyping, messages.length, profile?.name]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-royal text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phoenix mx-auto mb-4" />
          <p className="text-white/40">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-royal fade-in">
      <Sidebar />

      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        {/* Top 1/3: Compact Shadcn-style Accordion */}
        <div className="flex-shrink-0 max-h-[33vh] overflow-y-auto scrollbar-hide relative">
          <div className="px-6 lg:px-10 pt-6 pb-2">
            <div className="flex items-center gap-3 mb-3">
              <Sparkle size={18} className="text-chartreuse" weight="fill" />
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Weekly Tools</h2>
            </div>

            {/* Accordion */}
            <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/[0.06]">
              {tools.map((tool, index) => (
                <div key={tool.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 80}ms` }}>
                  {/* Collapsed: number, small square, name, tag, caret */}
                  <button
                    onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-all text-left"
                  >
                    <span className="text-[10px] text-white/20 font-mono w-5 shrink-0">{String(index + 1).padStart(2, '0')}</span>
                    <span className="w-2.5 h-2.5 rounded-sm bg-phoenix shrink-0" />
                    <span className="font-medium text-white text-sm flex-1 truncate">{tool.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 shrink-0 hidden sm:block">{tool.category}</span>
                    {triedTools.includes(tool.id) && <span className="w-1.5 h-1.5 rounded-full bg-chartreuse shrink-0" />}
                    <CaretDown size={12} className={`text-white/25 transition-transform duration-200 shrink-0 ${expandedTool === tool.id ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded: description, Explore, Mark Tried, Swap */}
                  <div className={`overflow-hidden transition-all duration-200 ease-out ${expandedTool === tool.id ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-3 pt-1 bg-white/[0.02]">
                      <p className="text-[11px] text-white/45 mb-2 line-clamp-2 pl-[34px]">{tool.description}</p>
                      <div className="flex items-center gap-1.5 pl-[34px]">
                        <a href={tool.website} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-[11px] font-medium hover:bg-white/20 transition-colors inline-flex items-center gap-1">
                          Explore <ArrowUpRight size={10} />
                        </a>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkAsTried(tool.id); }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${triedTools.includes(tool.id) ? 'bg-chartreuse/20 text-chartreuse' : 'bg-white/5 text-white/35 hover:bg-white/10'}`}
                        >
                          {triedTools.includes(tool.id) ? 'Tried' : 'Mark Tried'}
                        </button>
                        {stashedTools.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); swapTool(tool.id); }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 text-white/35 text-[11px] font-medium hover:bg-phoenix/20 hover:text-phoenix transition-colors"
                          >
                            Swap
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fade gradient at bottom */}
          <div className="sticky bottom-0 h-10 bg-gradient-to-t from-royal to-transparent pointer-events-none" />
        </div>

        {/* Bottom 2/3: Chat Interface */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-hide relative">
            <div className="sticky top-0 h-6 bg-gradient-to-b from-royal to-transparent z-10 pointer-events-none" />
            <div className="px-6 lg:px-10 pb-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'assistant' ? (
                    <div className="flex gap-3 max-w-2xl">
                      <div className="w-7 h-7 rounded-full bg-chartreuse/20 text-chartreuse flex items-center justify-center shrink-0 mt-1">
                        <Sparkle size={14} weight="fill" />
                      </div>
                      <div>
                        <div className="bg-white/[0.06] p-4 rounded-2xl rounded-tl-none text-white leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-strong:text-white prose-a:text-phoenix">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                          {message.isStreaming && <span className="inline-block w-1.5 h-4 bg-chartreuse ml-1 animate-pulse" />}
                        </div>
                        {!message.isStreaming && message.content && (
                          <div className="flex gap-1 mt-1 ml-1">
                            <button
                              onClick={() => handleFeedback(message.id, 1, message.content)}
                              className={`p-1 rounded transition-colors ${feedbackGiven[message.id] === 1 ? 'text-chartreuse' : 'text-white/20 hover:text-white/50'}`}
                              title="Helpful"
                            >
                              <ThumbsUp size={14} weight={feedbackGiven[message.id] === 1 ? 'fill' : 'regular'} />
                            </button>
                            <button
                              onClick={() => handleFeedback(message.id, -1, message.content)}
                              className={`p-1 rounded transition-colors ${feedbackGiven[message.id] === -1 ? 'text-phoenix' : 'text-white/20 hover:text-white/50'}`}
                              title="Not helpful"
                            >
                              <ThumbsDown size={14} weight={feedbackGiven[message.id] === -1 ? 'fill' : 'regular'} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3 max-w-2xl ml-auto flex-row-reverse">
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1">
                        <img
                          src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'User')}&background=ECA5CB&color=fff`}
                          className="w-full h-full object-cover"
                          alt="You"
                        />
                      </div>
                      <div className="bg-phoenix p-4 rounded-2xl rounded-tr-none text-white leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 max-w-2xl">
                  <div className="w-7 h-7 rounded-full bg-chartreuse/20 text-chartreuse flex items-center justify-center shrink-0 mt-1">
                    <Sparkle size={14} weight="fill" />
                  </div>
                  <div className="bg-white/[0.06] px-4 py-3 rounded-2xl rounded-tl-none">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Fixed Input */}
          <div className="shrink-0 px-6 lg:px-10 pb-5 pt-3 border-t border-white/5">
            <div className="relative max-w-3xl mx-auto">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Message Forge..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-5 pr-12 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-chartreuse/50 focus:ring-1 focus:ring-chartreuse/50 transition-all caret-chartreuse"
                disabled={isTyping}
                autoFocus
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-chartreuse text-royal rounded-lg hover:bg-chartreuse/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <PaperPlaneRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
