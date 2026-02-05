'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkle,
  CaretDown,
  CaretUp,
  Robot,
  ArrowUpRight,
  PaperPlaneRight,
} from '@phosphor-icons/react';
import Sidebar from '../components/Sidebar';
import type { ChatMessage, Tool } from '../../types';
import { getGreeting, generateId } from '../../lib/utils';

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial data
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const profile = localStorage.getItem('userProfile');
    const parsedProfile = profile ? JSON.parse(profile) : null;
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

  // Fetch tools from API
  useEffect(() => {
    async function fetchTools() {
      try {
        const res = await fetch('/api/tools');
        const data = await res.json();
        if (data.tools?.length) {
          setTools(data.tools);
        }
      } catch {
        // Tools API failed — will show empty state
      }
    }
    fetchTools();
  }, []);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined') {
      const messagesToSave = messages.map(m => ({ ...m, isStreaming: false }));
      localStorage.setItem('chatMessages', JSON.stringify(messagesToSave));
    }
  }, [messages]);

  const handleMarkAsTried = (toolId: number) => {
    if (triedTools.includes(toolId)) return;
    const newTriedTools = [...triedTools, toolId];
    setTriedTools(newTriedTools);
    if (typeof window !== 'undefined') {
      localStorage.setItem('triedTools', JSON.stringify(newTriedTools));
    }

    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'local-user',
        tool_id: toolId,
        status: 'tried',
      }),
    }).catch(() => {});
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    const assistantMessageId = generateId();

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: updatedMessages.slice(-20),
          userProfile: userProfile ? {
            focus: userProfile.focus,
            skill_level: userProfile.level,
            weekly_hours: userProfile.time,
            preferences: userProfile.preferences,
            existing_tools: userProfile.existing_tools,
            goal: userProfile.goal,
          } : undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Streaming response from Gemini
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          isStreaming: true,
        };
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
                    setMessages(prev =>
                      prev.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: fullContent }
                          : msg,
                      ),
                    );
                  }
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          }
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg,
            ),
          );
        }
      } else {
        // Non-streaming JSON response (fallback mode)
        const data = await res.json();
        const responseText = data.message || "I'm having trouble responding right now. Please try again.";

        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          isStreaming: true,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);

        // Simulate streaming for fallback responses
        const words = responseText.split(' ');
        let currentContent = '';
        for (let i = 0; i < words.length; i++) {
          currentContent += (i === 0 ? '' : ' ') + words[i];
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent }
                : msg,
            ),
          );
          await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
        }
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    }
  }, [inputValue, isTyping, messages, userProfile]);

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

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden relative">
        <div className="p-8 lg:p-12 max-w-5xl mx-auto h-full flex flex-col">
          {/* Accordion Tool Suggestions */}
          {tools.length > 0 && (
            <div className="mb-8 flex-shrink-0">
              <button
                onClick={() => setAccordionOpen(!accordionOpen)}
                className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/[0.07] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-chartreuse/20 flex items-center justify-center text-chartreuse">
                    <Sparkle size={20} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-white">Weekly Tool Suggestions</h3>
                    <p className="text-sm text-white/50">{tools.length} AI tools curated for you this week</p>
                  </div>
                </div>
                {accordionOpen ? (
                  <CaretUp size={20} className="text-white/40 group-hover:text-white/60 transition-all" />
                ) : (
                  <CaretDown size={20} className="text-white/40 group-hover:text-white/60 transition-all" />
                )}
              </button>

              {accordionOpen && (
                <div className="mt-4 space-y-3 max-h-[40vh] overflow-y-auto scrollbar-hide">
                  {tools.map(tool => (
                    <div key={tool.id} className="group bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/[0.07] transition-all">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center shrink-0`}>
                          <Robot size={20} className="text-royal" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-white">{tool.name}</h4>
                            <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60 shrink-0 ml-2">{tool.category}</span>
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed mb-3">{tool.description}</p>
                          <div className="flex items-center gap-2">
                            <a
                              href={tool.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors inline-flex items-center gap-2"
                            >
                              Explore <ArrowUpRight size={14} />
                            </a>
                            <button
                              onClick={() => handleMarkAsTried(tool.id)}
                              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                triedTools.includes(tool.id)
                                  ? 'bg-chartreuse/20 text-chartreuse'
                                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                              }`}
                            >
                              {triedTools.includes(tool.id) ? 'Tried' : 'Mark Tried'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat Interface */}
          <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden min-h-0">
            {/* Chat Header */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-chartreuse animate-pulse" />
                <span className="font-medium text-white text-sm">Forge AI Coach</span>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              <div className="text-center text-xs text-white/30 my-4">Today</div>

              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'assistant' ? (
                    <div className="flex gap-4 max-w-2xl">
                      <div className="w-8 h-8 rounded-full bg-chartreuse/20 text-chartreuse flex items-center justify-center shrink-0 mt-1">
                        <Sparkle size={16} weight="fill" />
                      </div>
                      <div className="bg-white/10 p-4 rounded-2xl rounded-tl-none text-white leading-relaxed whitespace-pre-line">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-1.5 h-4 bg-chartreuse ml-1 animate-pulse" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1">
                        <img
                          src="https://ui-avatars.com/api/?name=Alex+Forge&background=ECA5CB&color=fff"
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

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex gap-4 max-w-2xl">
                  <div className="w-8 h-8 rounded-full bg-chartreuse/20 text-chartreuse flex items-center justify-center shrink-0 mt-1">
                    <Sparkle size={16} weight="fill" />
                  </div>
                  <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-tl-none">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Message Forge..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-14 py-3.5 text-white placeholder-white/40 focus:outline-none focus:border-chartreuse/50 focus:ring-1 focus:ring-chartreuse/50 transition-all"
                  disabled={isTyping}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-chartreuse text-royal rounded-lg hover:bg-chartreuse/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PaperPlaneRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
