'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Sparkle,
  DotsThree,
  Microphone,
  PaperPlaneRight,
  Code,
} from '@phosphor-icons/react';
import Sidebar from '../components/Sidebar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  suggestions?: string[];
}

export default function Overview() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Good morning, Alex. Based on your activity, you were exploring Python libraries yesterday. Did you manage to set up the environment?"
    },
    {
      id: '2',
      role: 'user',
      content: "Yes, I did! But I'm stuck on choosing the right visualization library. Any suggestions?"
    },
    {
      id: '3',
      role: 'assistant',
      content: "For Python, it depends on your needs:\n\n1. Matplotlib: The standard, good for basics.\n2. Seaborn: Built on top of Matplotlib, better default aesthetics.\n3. Plotly: Excellent for interactive web-based charts.\n\nGiven you like minimal design, I'd suggest starting with Seaborn or Plotly. Shall I show you a comparison?",
      suggestions: ['Show Comparison', 'Give me code snippets']
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem('overviewChatMessages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 3 && typeof window !== 'undefined') {
      localStorage.setItem('overviewChatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  const simulateStreamingResponse = async (response: string, messageId: string) => {
    const words = response.split(' ');
    let currentContent = '';
    for (let i = 0; i < words.length; i++) {
      currentContent += (i === 0 ? '' : ' ') + words[i];
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, content: currentContent, isStreaming: true } : msg
      ));
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
    }
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, isStreaming: false } : msg
    ));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    };
    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
    await simulateStreamingResponse(
      "That's a great question! Based on your project needs, I'd recommend starting with Seaborn for quick, beautiful visualizations. If you need interactivity later, Plotly integrates well. Would you like me to set up a starter template?",
      assistantMessageId
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
              <div className="text-center text-xs text-gray-400 my-4">Today, 9:41 AM</div>

              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'assistant' ? (
                    <div className="flex gap-4 max-w-2xl">
                      <div className="w-8 h-8 rounded-full bg-royal text-chartreuse flex items-center justify-center shrink-0 mt-1">
                        <Sparkle size={16} weight="fill" />
                      </div>
                      <div className="space-y-2">
                        <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none text-royal leading-relaxed whitespace-pre-line">
                          {message.content}
                          {message.isStreaming && (
                            <span className="inline-block w-1.5 h-4 bg-royal ml-1 animate-pulse" />
                          )}
                        </div>
                        {message.suggestions && (
                          <div className="flex gap-2 mt-2">
                            {message.suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-6 pr-32 py-4 text-royal focus:outline-none focus:border-phoenix focus:ring-1 focus:ring-phoenix transition-all placeholder-gray-400"
                  disabled={isTyping}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-royal transition-colors">
                    <Microphone size={20} />
                  </button>
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
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Context & Memories</h4>

            <div className="space-y-6">
              <div>
                <h5 className="text-sm font-semibold text-royal mb-2">Current Project</h5>
                <div className="p-3 bg-white border border-gray-100 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-umber/10 text-umber flex items-center justify-center">
                    <Code size={16} />
                  </div>
                  <div className="text-xs">
                    <div className="font-medium text-royal">Data Viz Dashboard</div>
                    <div className="text-gray-400">Python, Streamlit</div>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-royal mb-2">Related Tools</h5>
                <div className="space-y-2">
                  <div className="p-2 hover:bg-white rounded-lg cursor-pointer transition-colors text-sm flex items-center gap-2 text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-chartreuse" />
                    Streamlit
                  </div>
                  <div className="p-2 hover:bg-white rounded-lg cursor-pointer transition-colors text-sm flex items-center gap-2 text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-phoenix" />
                    Pandas AI
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-royal mb-2">Weekly Goal</h5>
                <div className="p-4 bg-magnolia/20 rounded-xl border border-magnolia text-xs leading-relaxed text-royal/80 italic">
                  &ldquo;I want to become proficient in building interactive dashboards by Friday.&rdquo;
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
