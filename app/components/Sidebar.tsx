'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  FireSimple,
  ChatCircleText,
  SquaresFour,
  ChartBar,
  GearSix,
} from '@phosphor-icons/react';

export default function Sidebar() {
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [triedTools, setTriedTools] = useState<number[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const profile = localStorage.getItem('userProfile');
    if (profile) setUserProfile(JSON.parse(profile));
    const tried = localStorage.getItem('triedTools');
    if (tried) setTriedTools(JSON.parse(tried));
  }, []);

  // Calculate weekly goal progress based on tools tried (target: 3 tools/week)
  const weeklyTarget = 3;
  const progress = Math.min(Math.round((triedTools.length / weeklyTarget) * 100), 100);

  const navItems = [
    { href: '/dashboard', label: 'Chat', icon: ChatCircleText, hasNotification: true },
    { href: '/overview', label: 'Overview', icon: SquaresFour, hasNotification: false },
    { href: '/tracker', label: 'Tracker', icon: ChartBar, hasNotification: false },
    { href: '/settings', label: 'Settings', icon: GearSix, hasNotification: false },
  ];

  return (
    <aside className="w-20 lg:w-64 bg-royal border-r border-white/10 flex flex-col justify-between py-8 px-4 transition-all duration-300">
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-12 text-white">
          <div className="w-8 h-8 rounded-lg bg-phoenix flex items-center justify-center text-white shrink-0">
            <FireSimple size={18} weight="fill" />
          </div>
          <span className="font-serif font-bold text-xl hidden lg:block tracking-tight">Forge</span>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium hidden lg:block">{item.label}</span>
                {!isActive && item.hasNotification && (
                  <span className="w-2 h-2 rounded-full bg-phoenix ml-auto hidden lg:block" />
                )}
              </a>
            );
          })}
        </nav>
      </div>

      <div>
        {/* Weekly Goal */}
        <div className="p-4 bg-white/5 rounded-2xl hidden lg:block mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase text-white/40">Weekly Goal</span>
            <span className="text-xs font-bold text-white">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-chartreuse transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-white/60 mt-2">
            {userProfile?.goal
              ? (userProfile.goal.length > 35 ? userProfile.goal.substring(0, 35) + '...' : userProfile.goal)
              : `${triedTools.length}/${weeklyTarget} tools explored`}
          </p>
        </div>

        {/* Profile */}
        <a
          href="/settings"
          className="flex items-center gap-3 px-2 w-full hover:bg-white/5 rounded-xl p-2 transition-colors cursor-pointer"
        >
          <img
            src="https://ui-avatars.com/api/?name=Alex+Forge&background=ECA5CB&color=fff"
            className="w-8 h-8 rounded-full border border-white/20"
            alt="Profile"
          />
          <div className="hidden lg:flex flex-col items-start">
            <span className="text-sm font-medium text-white">
              {userProfile?.focus ? `${userProfile.focus} Creator` : 'Forge User'}
            </span>
            <span className="text-[10px] text-white/50">
              {userProfile?.level || 'Getting started'}
            </span>
          </div>
        </a>
      </div>
    </aside>
  );
}
