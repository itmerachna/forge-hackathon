'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  ChatCircleText,
  SquaresFour,
  ChartBar,
  GearSix,
  SignOut,
  CaretLeft,
  CaretRight,
  Circle,
  CheckCircle,
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [userProfile, setUserProfile] = useState<Record<string, string> | null>(null);
  const [triedTools, setTriedTools] = useState<number[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [goalDone, setGoalDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const localProfile = localStorage.getItem('userProfile');
    if (localProfile) setUserProfile(JSON.parse(localProfile));
    const tried = localStorage.getItem('triedTools');
    if (tried) setTriedTools(JSON.parse(tried));
    const gd = localStorage.getItem('goalDone');
    if (gd) setGoalDone(JSON.parse(gd));
  }, []);

  const toggleGoalDone = () => {
    const next = !goalDone;
    setGoalDone(next);
    if (typeof window !== 'undefined') localStorage.setItem('goalDone', JSON.stringify(next));
  };

  const weeklyTarget = 5;
  const progress = Math.min(Math.round((triedTools.length / weeklyTarget) * 100), 100);

  const navItems = [
    { href: '/dashboard', label: 'Chat', icon: ChatCircleText, hasNotification: true },
    { href: '/overview', label: 'Overview', icon: SquaresFour, hasNotification: false },
    { href: '/tracker', label: 'Tracker', icon: ChartBar, hasNotification: false },
    { href: '/settings', label: 'Settings', icon: GearSix, hasNotification: false },
  ];

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-20 lg:w-64'} bg-royal border-r border-white/10 flex flex-col justify-between py-8 px-4 transition-all duration-300 relative`}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-12 w-6 h-6 rounded-full bg-royal border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors z-10 hidden lg:flex"
      >
        {collapsed ? <CaretRight size={12} /> : <CaretLeft size={12} />}
      </button>

      <div>
        {/* Logo */}
        <a href="/" className="flex items-center px-2 mb-12 hover:opacity-80 transition-opacity">
          <Image
            src="/forge-logo.svg"
            alt="Forge"
            width={collapsed ? 32 : 100}
            height={32}
            priority
          />
        </a>

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
                {!collapsed && <span className="font-medium hidden lg:block">{item.label}</span>}
                {!isActive && item.hasNotification && !collapsed && (
                  <span className="w-2 h-2 rounded-full bg-phoenix ml-auto hidden lg:block" />
                )}
              </a>
            );
          })}
        </nav>
      </div>

      <div>
        {/* Weekly Goal */}
        <div className={`p-4 bg-white/5 rounded-2xl mb-6 ${collapsed ? 'hidden' : 'hidden lg:block'}`}>
          <span className="text-xs font-bold uppercase text-white/40 block mb-3">Weekly Goal</span>

          {/* Tools tried progress */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-white/60">{triedTools.length}/{weeklyTarget} tools tried</span>
              <span className="text-xs font-bold text-white">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-chartreuse transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* User goal with checkbox */}
          {userProfile?.goal && (
            <button
              onClick={toggleGoalDone}
              className="flex items-start gap-2 w-full text-left"
            >
              {goalDone ? (
                <CheckCircle size={16} className="text-chartreuse shrink-0 mt-0.5" weight="fill" />
              ) : (
                <Circle size={16} className="text-white/30 shrink-0 mt-0.5" />
              )}
              <span className={`text-xs leading-snug ${goalDone ? 'text-chartreuse line-through' : 'text-white/60'}`}>
                {userProfile.goal.length > 40 ? userProfile.goal.substring(0, 40) + '...' : userProfile.goal}
              </span>
            </button>
          )}
        </div>

        {/* Profile */}
        <div className="space-y-2">
          <a
            href="/settings"
            className="flex items-center gap-3 px-2 w-full hover:bg-white/5 rounded-xl p-2 transition-colors cursor-pointer"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                className="w-8 h-8 rounded-full border border-white/20 object-cover"
                alt="Profile"
              />
            ) : (
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'User')}&background=ECA5CB&color=fff`}
                className="w-8 h-8 rounded-full border border-white/20"
                alt="Profile"
              />
            )}
            {!collapsed && (
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-sm font-medium text-white">
                  {profile?.name || 'Forge User'}
                </span>
                <span className="text-[10px] text-white/50">
                  @{profile?.username || 'user'}
                </span>
              </div>
            )}
          </a>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 text-white/40 hover:text-white/60 hover:bg-white/5 rounded-xl transition-colors"
          >
            <SignOut size={18} />
            {!collapsed && <span className="text-xs hidden lg:block">Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
