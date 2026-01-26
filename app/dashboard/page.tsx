'use client';
import { useState, useEffect } from 'react';

const SAMPLE_TOOLS = [
  {
    id: 1,
    name: "AKOOL",
    description: "AI Video Creation Made Easy – Avatars, Translation, and Face Swap in One Platform",
    category: "AI Video Editor",
    pricing: "Freemium",
    website: "https://akool.com",
    difficulty: "Beginner"
  },
  {
    id: 2,
    name: "PixAI",
    description: "World's No.1 Anime & Character Generation AI",
    category: "AI Design",
    pricing: "Paid ($9.99/mo+)",
    website: "https://pixai.art/en",
    difficulty: "Beginner"
  },
  {
    id: 3,
    name: "RecCloud",
    description: "AI Audio & Video Processing platform for creators",
    category: "AI Audio",
    pricing: "Freemium",
    website: "https://reccloud.com",
    difficulty: "Beginner"
  },
  {
    id: 4,
    name: "KREA AI",
    description: "AI Creative Suite for Images, Video & 3D content generation",
    category: "AI Design",
    pricing: "Freemium",
    website: "https://www.krea.ai",
    difficulty: "Intermediate"
  },
  {
    id: 5,
    name: "Gamma",
    description: "Effortless AI design for presentations, websites, and more",
    category: "AI Design",
    pricing: "Freemium",
    website: "https://gamma.app",
    difficulty: "Beginner"
  },
  {
    id: 6,
    name: "Anything",
    description: "Turn your words into mobile apps, sites, tools, and products - built with code",
    category: "Vibe Coding",
    pricing: "Freemium",
    website: "https://www.anything.com",
    difficulty: "Intermediate"
  },
  {
    id: 7,
    name: "Relume",
    description: "Websites designed and built faster with AI",
    category: "AI Site Builder",
    pricing: "Freemium",
    website: "https://www.relume.io",
    difficulty: "Beginner"
  },
  {
    id: 8,
    name: "Descript",
    description: "AI editing for every kind of video with transcription and voice cloning",
    category: "AI Video Editor",
    pricing: "Paid ($24/mo+)",
    website: "https://www.descript.com",
    difficulty: "Intermediate"
  },
  {
    id: 9,
    name: "PicWish",
    description: "All-in-one free AI photo editor - create professional photos effortlessly",
    category: "AI Photo Editor",
    pricing: "Freemium",
    website: "https://picwish.com",
    difficulty: "Beginner"
  },
  {
    id: 10,
    name: "Luma AI",
    description: "Production-ready images and videos with precision, speed, and control",
    category: "AI Design",
    pricing: "Freemium",
    website: "https://lumalabs.ai",
    difficulty: "Intermediate"
  }
];

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const profile = localStorage.getItem('userProfile');
      if (profile) {
        setUserProfile(JSON.parse(profile));
      }
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-800 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-2xl">
              🔨
            </div>
            <h1 className="text-2xl font-bold">Forge</h1>
          </div>
          <a href="/" className="text-gray-400 hover:text-white transition">
            Home
          </a>
        </div>
      </nav>
      
      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">This Week's Tools</h2>
          <p className="text-gray-400">
            {userProfile?.goal ? (
              <>Based on your goal: {userProfile.goal}</>
            ) : (
              <>Personalized recommendations for you</>
            )}
          </p>
          <div className="mt-4 flex gap-2 text-sm">
            <span className="bg-gray-800 px-3 py-1 rounded-full">
              {userProfile?.focus || 'All categories'}
            </span>
            <span className="bg-gray-800 px-3 py-1 rounded-full">
              {userProfile?.level || 'All levels'}
            </span>
            <span className="bg-gray-800 px-3 py-1 rounded-full">
              {userProfile?.time || 'Flexible timing'}
            </span>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {SAMPLE_TOOLS.map((tool) => (
            <div key={tool.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-orange-500 transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">{tool.name}</h3>
                  <span className="text-sm text-gray-400">{tool.category}</span>
                </div>
                <div className="flex gap-2">
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
                    {tool.pricing}
                  </span>
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
                    {tool.difficulty}
                  </span>
                </div>
              </div>
              
              <p className="text-gray-300 mb-4">{tool.description}</p>
              
             <div className="flex gap-2">
                <a href={tool.website} target="_blank" rel="noopener noreferrer" className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded text-sm font-semibold transition">
                  Visit Tool
                </a>
                <button className="border border-gray-600 hover:border-gray-500 px-4 py-2 rounded text-sm transition">
                  Mark as Tried
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
          <h3 className="text-xl font-bold mb-2">🎯 Your Weekly Goal</h3>
          <p className="text-gray-400 mb-4">Try at least 2 tools this week to unlock next week's recommendations</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-2xl font-bold text-orange-500">0/2</div>
            <div className="text-gray-400">tools tried</div>
          </div>
        </div>
      </main>
    </div>
  );
}
