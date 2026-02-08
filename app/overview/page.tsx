'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkle,
  DotsThree,
  PaperPlaneRight,
  Code,
  Target,
  Lightning,
} from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import Sidebar from '../components/Sidebar';
import type { ChatMessage } from '../../types';
import { getGreeting, generateId } from '../../lib/utils';

export default function Overview() {
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(generateId());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const profile = localStorage.getItem('userProfile');
    const parsedProfile = profile ? JSON.parse(profile) : null;
    setUserProfile(parsedProfile);

    const tried = localStorage.getItem('triedTools');
    if (tried) setTriedTools(JSON.parse(tried));

    const savedMessages = localStorage.getItem('overviewChatMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      setMessages([
        {
          id: generateId(),
          role: 'assistant',
          content: `${getGreeting()} This is your overview space. I can help you reflect on your progress, plan projects, or dive deeper into any tool you're exploring. What's on your mind?`,
          suggestions: ['Review my progress', 'Help me plan a project'],
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined') {
      const messagesToSave = messages.map(m => ({ ...m, isStreaming: false }));
      localStorage.setItem('overviewChatMessages', JSON.stringify(messagesToSave));
    }
  }, [messages]);

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
          context: 'This is the overview/reflection space. Help the user reflect on progress, plan projects, and explore tools in depth.',
          session_id: sessionIdRef.current,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
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
                        msg.id === assistantMessageId ? { ...msg, content: fullContent } : msg,
                      ),
                    );
                  }
                } catch { /* skip */ }
              }
            }
          }
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg,
            ),
          );
        }
      } else {
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

        const words = responseText.split(' ');
        let currentContent = '';
        for (let i = 0; i < words.length; i++) {
          currentContent += (i === 0 ? '' : ' ') + words[i];
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: currentContent } : msg,
            ),
          );
          await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
        }
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg,
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

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  return (
    <div className="flex w-full h-screen bg-royal fade-in">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden relative">
        <div className="flex h-full w-full">
          {/* Chat Container */}
          <div className="flex-1 flex flex-col h-full relative bg-white">
            {/* Top Bar */}
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-chartreuse animate-pulse" />
                <span className="font-medium text-royal">Forge Assistant</span>
              </div>
              <div className="flex gap-2 text-gray-400">
                <button className="hover:text-royal p-2">
                  <DotsThree size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              <div className="text-center text-xs text-gray-400 my-4">Today</div>

              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'assistant' ? (
                    <div className="flex gap-4 max-w-2xl">
                      <div className="w-8 h-8 rounded-full bg-royal text-chartreuse flex items-center justify-center shrink-0 mt-1">
                        <Sparkle size={16} weight="fill" />
                      </div>
                      <div className="space-y-2">
                        <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none text-royal leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-strong:text-royal prose-a:text-phoenix">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                          {message.isStreaming && (
                            <span className="inline-block w-1.5 h-4 bg-royal ml-1 animate-pulse" />
                          )}
                        </div>
                        {message.suggestions && (
                          <div className="flex gap-2 mt-2">
                            {message.suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-magnolia/50 transition-colors text-royal"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-magnolia border border-gray-200 overflow-hidden shrink-0 mt-1">
                        <img
                          src="https://ui-avatars.com/api/?name=Alex+Forge&background=ECA5CB&color=fff"
                          className="w-full h-full object-cover"
                          alt="You"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="bg-royal text-white p-4 rounded-2xl rounded-tr-none leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex gap-4 max-w-2xl">
                  <div className="w-8 h-8 rounded-full bg-royal text-chartreuse flex items-center justify-center shrink-0 mt-1">
                    <Sparkle size={16} weight="fill" />
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-none">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-gray-100 shrink-0">
              <div className="relative max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Message Forge..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-6 pr-16 py-4 text-royal focus:outline-none focus:border-phoenix focus:ring-1 focus:ring-phoenix transition-all placeholder-gray-400"
                  disabled={isTyping}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isTyping}
                    className="p-2 bg-royal text-white rounded-xl hover:bg-maiden transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PaperPlaneRight size={18} />
                  </button>
                </div>
              </div>
              <div className="text-center mt-3">
                <p className="text-[10px] text-gray-400">Forge can make mistakes. Consider checking important info.</p>
              </div>
            </div>
          </div>

          {/* Right Context Sidebar */}
          <div className="w-80 border-l border-gray-100 bg-light p-6 hidden xl:block overflow-y-auto">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Context & Progress</h4>

            <div className="space-y-6">
              {/* Tools Tried */}
              <div>
                <h5 className="text-sm font-semibold text-royal mb-2">Tools Explored</h5>
                <div className="p-3 bg-white border border-gray-100 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-chartreuse/20 text-chartreuse flex items-center justify-center">
                    <Lightning size={16} weight="fill" />
                  </div>
                  <div className="text-xs">
                    <div className="font-medium text-royal">{triedTools.length} tools tried</div>
                    <div className="text-gray-400">this week</div>
                  </div>
                </div>
              </div>

              {/* Focus Area */}
              {userProfile?.focus && (
                <div>
                  <h5 className="text-sm font-semibold text-royal mb-2">Focus Area</h5>
                  <div className="p-3 bg-white border border-gray-100 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-umber/10 text-umber flex items-center justify-center">
                      <Code size={16} />
                    </div>
                    <div className="text-xs">
                      <div className="font-medium text-royal">{userProfile.focus}</div>
                      <div className="text-gray-400">{userProfile.level || 'Not set'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Weekly Goal */}
              {userProfile?.goal && (
                <div>
                  <h5 className="text-sm font-semibold text-royal mb-2">Weekly Goal</h5>
                  <div className="p-4 bg-magnolia/20 rounded-xl border border-magnolia text-xs leading-relaxed text-royal/80 italic flex items-start gap-2">
                    <Target size={14} className="shrink-0 mt-0.5" />
                    <span>&ldquo;{userProfile.goal}&rdquo;</span>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <h5 className="text-sm font-semibold text-royal mb-2">Quick Actions</h5>
                <div className="space-y-2">
                  <button
                    onClick={() => setInputValue('Give me a daily check-in')}
                    className="w-full p-2 hover:bg-white rounded-lg cursor-pointer transition-colors text-sm flex items-center gap-2 text-gray-600 text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-chartreuse" />
                    Daily Check-in
                  </button>
                  <button
                    onClick={() => setInputValue('Help me reflect on my week')}
                    className="w-full p-2 hover:bg-white rounded-lg cursor-pointer transition-colors text-sm flex items-center gap-2 text-gray-600 text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-phoenix" />
                    Weekly Reflection
                  </button>
                  <button
                    onClick={() => setInputValue('Suggest a project idea for me')}
                    className="w-full p-2 hover:bg-white rounded-lg cursor-pointer transition-colors text-sm flex items-center gap-2 text-gray-600 text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-lavender" />
                    Project Ideas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
