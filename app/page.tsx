import {
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="w-full h-screen bg-royal text-magnolia flex items-center justify-center relative overflow-hidden fade-in">
      {/* Centered Content Group */}
      <div className="flex flex-col items-center text-center px-4 relative z-10">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/forge-logo.svg"
            alt="Forge"
            width={120}
            height={48}
            priority
          />
        </div>

        {/* Version Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs uppercase tracking-widest text-chartreuse">
          <span className="w-2 h-2 rounded-full bg-phoenix animate-pulse" />
          v.00 is now live
        </div>

        {/* Heading */}
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white mb-6 leading-[0.9]">
          Forge your craft, <br />
          <span className="italic text-magnolia/90">one tool at a time</span>
        </h1>

        {/* Body Copy */}
        <p className="max-w-lg text-sm md:text-base text-magnolia/60 font-light mb-8 leading-snug">
          Your personal AI agent for curated AI tool discovery, daily accountability, and deep reflection on your digital craft. Let Forge help you actually master the tools you bookmark and filter noise.
        </p>

        {/* CTA Button */}
        <Link
          href="/auth/signup"
          className="px-5 py-2.5 bg-phoenix text-white font-medium text-sm rounded-full hover:bg-orange-600 transition-colors shadow-glow flex items-center gap-2 group"
        >
          Get Started or Sign Back In
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Abstract Visuals */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-maiden/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-phoenix/10 rounded-full blur-[120px] pointer-events-none" />

    </div>
  );
}
