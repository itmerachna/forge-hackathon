'use client';
import { useState, useEffect, useRef } from 'react';

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
    icon: "🎬"
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
    icon: "🎨"
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
    icon: "🎙️"
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
    icon: "✨"
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
    icon: "📊"
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
    icon: "🚀"
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
    icon: "🌐"
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
    icon: "🎥"
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
    icon: "📷"
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
    icon: "💫"
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
  const [expandedTool, setExpandedTool] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm your AI tool coach. I can help you discover the perfect AI tools for your projects, explain how to use them, or suggest workflows. What would you like to explore today?"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        msg.id === messageId
          ? { ...msg, content: currentContent, isStreaming: true }
          : msg
      ));
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
    }

    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, isStreaming: false }
        : msg
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Navigation */}
      <nav className="border-b border-gray-800 px-4 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-lg">
              🔨
            </div>
            <h1 className="text-xl font-bold">Forge</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {triedTools.length}/2 tools tried
            </span>
            <a href="/" className="text-gray-400 hover:text-white transition text-sm">
              Home
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-6xl mx-auto w-full">
        {/* Compact Tool List - Top 1/3 */}
        <div className="h-[33vh] flex flex-col border-b border-gray-800 relative">
          <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <h2 className="text-lg font-semibold">This Week's Tools</h2>
            <p className="text-xs text-gray-400">Click to expand details</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {SAMPLE_TOOLS.map((tool, index) => {
              const isExpanded = expandedTool === tool.id;
              const isTried = triedTools.includes(tool.id);

              return (
                <div
                  key={tool.id}
                  className={`border-b border-gray-800 last:border-b-0 ${isExpanded ? 'bg-gray-800/50' : ''}`}
                >
                  {/* Collapsed Row */}
                  <div
                    onClick={() => setExpandedTool(isExpanded ? null : tool.id)}
                    className="flex items-center gap-3 py-2.5 px-2 cursor-pointer hover:bg-gray-800/30 transition rounded"
                  >
                    {/* Serial Number */}
                    <span className="text-gray-500 text-sm w-5 flex-shrink-0">{index + 1}</span>

                    {/* Icon */}
                    <span className="text-xl flex-shrink-0">{tool.icon}</span>

                    {/* Name */}
                    <span className="font-medium w-24 flex-shrink-0">{tool.name}</span>

                    {/* Description */}
                    <span className="text-gray-400 text-sm flex-1 truncate">{tool.description}</span>

                    {/* Category Tag */}
                    <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded flex-shrink-0">
                      {tool.category}
                    </span>

                    {/* Links */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={tool.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-orange-400 transition"
                        title="Website"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </a>
                      <a
                        href={tool.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-400 hover:text-blue-400 transition"
                        title="Twitter"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                    </div>

                    {/* Tried Badge */}
                    {isTried && (
                      <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                    )}

                    {/* Expand Arrow */}
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-12 pb-3 pt-1">
                      <p className="text-gray-300 text-sm mb-3">{tool.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
                          {tool.pricing}
                        </span>
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
                          {tool.difficulty}
                        </span>
                        <a
                          href={tool.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-orange-500 hover:bg-orange-600 px-3 py-1 rounded text-xs font-semibold transition"
                        >
                          Visit Tool
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsTried(tool.id);
                          }}
                          className={`px-3 py-1 rounded text-xs transition ${
                            isTried
                              ? 'bg-green-500/20 text-green-400 border border-green-500'
                              : 'border border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          {isTried ? '✓ Tried' : 'Mark as Tried'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fade Gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none"></div>
        </div>

        {/* Chat Interface - Bottom 2/3 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs">
                🤖
              </div>
              <h2 className="text-lg font-semibold">AI Tool Coach</h2>
              <span className="text-xs text-gray-500">• Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : 'bg-gray-800 text-gray-100 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm leading-relaxed">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-current ml-1 animate-pulse" />
                    )}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box - Fixed at Bottom */}
          <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about any AI tool..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition placeholder-gray-500"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed p-2.5 rounded-full transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Press Enter to send • AI responses are for guidance only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
