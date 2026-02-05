'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Sparkle,
  CaretDown,
  CaretUp,
  Robot,
  ArrowUpRight,
  PaperPlaneRight,
} from '@phosphor-icons/react';
import Sidebar from '../components/Sidebar';

const SAMPLE_TOOLS = [
  {
    id: 1,
    name: "AKOOL",
    description: "AI Video Creation Made Easy – Avatars, Translation, and Face Swap in One Platform",
    category: "AI Video Editor",
    pricing: "Freemium",
    website: "https://akool.com",
    twitter: "https://twitter.com/AKOOLGlobal",
    difficulty: "Beginner",
    color: "bg-phoenix"
  },
  {
    id: 2,
    name: "PixAI",
    description: "World's No.1 Anime & Character Generation AI",
    category: "AI Design",
    pricing: "Paid ($9.99/mo+)",
    website: "https://pixai.art/en",
    twitter: "https://twitter.com/PixAI_Official",
    difficulty: "Beginner",
    color: "bg-chartreuse"
  },
  {
    id: 3,
    name: "RecCloud",
    description: "AI Audio & Video Processing platform for creators",
    category: "AI Audio",
    pricing: "Freemium",
    website: "https://reccloud.com",
    twitter: "https://twitter.com/RecCloud_",
    difficulty: "Beginner",
    color: "bg-cornflower"
  },
  {
    id: 4,
    name: "KREA AI",
    description: "AI Creative Suite for Images, Video & 3D content generation",
    category: "AI Design",
    pricing: "Freemium",
    website: "https://www.krea.ai",
    twitter: "https://twitter.com/kaborea",
    difficulty: "Intermediate",
    color: "bg-lavender"
  },
  {
    id: 5,
    name: "Gamma",
    description: "Effortless AI design for presentations, websites, and more",
    category: "AI Design",
    pricing: "Freemium",
    website: "https://gamma.app",
    twitter: "https://twitter.com/MeetGamma",
    difficulty: "Beginner",
    color: "bg-magnolia"
  },
  {
    id: 6,
    name: "Anything",
    description: "Turn your words into mobile apps, sites, tools, and products - built with code",
    category: "Vibe Coding",
    pricing: "Freemium",
    website: "https://www.anything.com",
    twitter: "https://twitter.com/anything",
    difficulty: "Intermediate",
    color: "bg-phoenix"
  },
  {
    id: 7,
    name: "Relume",
    description: "Websites designed and built faster with AI",
    category: "AI Site Builder",
    pricing: "Freemium",
    website: "https://www.relume.io",
    twitter: "https://twitter.com/reaborea",
    difficulty: "Beginner",
    color: "bg-chartreuse"
  },
  {
    id: 8,
    name: "Descript",
    description: "AI editing for every kind of video with transcription and voice cloning",
    category: "AI Video Editor",
    pricing: "Paid ($24/mo+)",
    website: "https://www.descript.com",
    twitter: "https://twitter.com/DescriptApp",
    difficulty: "Intermediate",
    color: "bg-cornflower"
  },
  {
    id: 9,
    name: "PicWish",
    description: "All-in-one free AI photo editor - create professional photos effortlessly",
    category: "AI Photo Editor",
    pricing: "Freemium",
    website: "https://picwish.com",
    twitter: "https://twitter.com/PicWish",
    difficulty: "Beginner",
    color: "bg-lavender"
  },
  {
    id: 10,
    name: "Luma AI",
    description: "Production-ready images and videos with precision, speed, and control",
    category: "AI Design",
    pricing: "Freemium",
    website: "https://lumalabs.ai",
    twitter: "https://twitter.com/LumaLabsAI",
    difficulty: "Intermediate",
    color: "bg-magnolia"
  }
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Good morning, Alex! Ready for your daily check-in? I noticed you've been exploring Python visualization libraries. How's that going?"
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
      const profile = localStorage.getItem('userProfile');
      if (profile) {
        setUserProfile(JSON.parse(profile));
      }
      const tried = localStorage.getItem('triedTools');
      if (tried) {
        setTriedTools(JSON.parse(tried));
      }
      const savedMessages = localStorage.getItem('chatMessages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 1 && typeof window !== 'undefined') {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages]);

  const handleMarkAsTried = (toolId: number) => {
    if (triedTools.includes(toolId)) return;
    const newTriedTools = [...triedTools, toolId];
    setTriedTools(newTriedTools);
    if (typeof window !== 'undefined') {
      localStorage.setItem('triedTools', JSON.stringify(newTriedTools));
    }
  };

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

  const generateResponse = (userMessage: string): string => {
    const lowerMsg = userMessage.toLowerCase();
    if (lowerMsg.includes('video') || lowerMsg.includes('edit')) {
      return "For video work, I'd recommend checking out AKOOL or Descript! AKOOL is great for beginners with its AI avatars and face swap features. Descript is more advanced but offers amazing transcription-based editing. Which one interests you more?";
    }
    if (lowerMsg.includes('design') || lowerMsg.includes('image')) {
      return "For design and image generation, you have some excellent options! KREA AI offers a full creative suite, while PixAI specializes in anime-style art. Gamma is perfect if you need presentation designs. What type of design work are you focusing on?";
    }
    if (lowerMsg.includes('website') || lowerMsg.includes('web') || lowerMsg.includes('site')) {
      return "For website building, Relume is fantastic - it uses AI to design and build sites faster. If you want to go beyond websites into full apps, check out Anything which can turn your ideas into mobile apps and products. Are you building something specific?";
    }
    if (lowerMsg.includes('audio') || lowerMsg.includes('podcast') || lowerMsg.includes('music')) {
      return "RecCloud is your go-to for audio processing! It handles everything from transcription to audio enhancement. If you're doing video podcasts, Descript also has excellent audio editing with voice cloning. What audio project are you working on?";
    }
    if (lowerMsg.includes('beginner') || lowerMsg.includes('start') || lowerMsg.includes('easy')) {
      return "Great starting points for beginners: Gamma for presentations (super intuitive), PicWish for photo editing (instant results), and AKOOL for video creation. All have free tiers! Which area interests you most?";
    }
    if (lowerMsg.includes('free') || lowerMsg.includes('pricing') || lowerMsg.includes('cost')) {
      return "Most tools here offer freemium plans! AKOOL, Gamma, RecCloud, KREA AI, Anything, Relume, PicWish, and Luma AI all have free tiers. PixAI starts at $9.99/mo and Descript at $24/mo for paid features. What's your budget range?";
    }
    if (lowerMsg.includes('recommend') || lowerMsg.includes('suggest') || lowerMsg.includes('best')) {
      const profile = userProfile;
      if (profile?.focus) {
        return `Based on your focus on ${profile.focus}, I'd suggest starting with ${profile.level === 'Beginner' ? 'Gamma or PicWish' : 'KREA AI or Descript'}. They match your skill level and have great learning resources. Want me to explain any of them in detail?`;
      }
      return "To give you the best recommendation, tell me: What are you trying to create? A video, design, website, or something else?";
    }
    return "I'd love to help you find the right tool! Tell me more about your project - are you looking to create videos, designs, websites, or something else? I can match you with the perfect AI tool.";
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
    const response = generateResponse(userMessage.content);
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    };
    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
    await simulateStreamingResponse(response, assistantMessageId);
  };

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
                  <p className="text-sm text-white/50">{SAMPLE_TOOLS.length} AI tools curated for you this week</p>
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
                {SAMPLE_TOOLS.map(tool => (
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
                      <div className="bg-white/10 p-4 rounded-2xl rounded-tl-none text-white leading-relaxed">
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
