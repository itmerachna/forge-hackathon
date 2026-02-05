import {
  FireSimple,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr';

export default function Home() {
  return (
    <div className="w-full h-screen bg-royal text-magnolia flex flex-col relative overflow-hidden fade-in">
      {/* Nav */}
      <nav className="w-full p-8 flex justify-between items-center z-10">
        <div className="text-2xl font-serif italic font-bold tracking-tight text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-phoenix flex items-center justify-center text-royal">
            <FireSimple size={20} weight="fill" />
          </div>
          Forge.
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium tracking-wide text-magnolia/80">
          <a href="#" className="hover:text-chartreuse transition-colors">Manifesto</a>
          <a href="#" className="hover:text-chartreuse transition-colors">Pricing</a>
          <a href="#" className="hover:text-chartreuse transition-colors">Login</a>
        </div>
        <a
          href="/onboarding"
          className="px-6 py-2 bg-chartreuse text-royal font-semibold rounded-full hover:bg-white transition-colors"
        >
          Start Trial
        </a>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs uppercase tracking-widest text-chartreuse">
          <span className="w-2 h-2 rounded-full bg-phoenix animate-pulse" />
          AI Coach v2.0 Live
        </div>
        <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl text-white mb-8 leading-[0.9]">
          Forge Your <br />
          <span className="italic text-magnolia/90">Creative Edge</span>
        </h1>
        <p className="max-w-xl text-lg md:text-xl text-magnolia/60 font-light mb-12 leading-relaxed">
          Your personal AI agent for curated tool discovery, daily accountability, and deep reflection on your digital craft.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <a
            href="/onboarding"
            className="px-8 py-4 bg-phoenix text-white font-medium text-lg rounded-full hover:bg-orange-600 transition-colors shadow-glow flex items-center gap-2 group"
          >
            Begin Onboarding
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <button className="px-8 py-4 border border-white/20 text-white font-medium text-lg rounded-full hover:bg-white/5 transition-colors">
            Watch Demo
          </button>
        </div>
      </div>

      {/* Abstract Visuals */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-maiden/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-phoenix/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Footer Strip */}
      <div className="w-full border-t border-white/5 p-6 flex justify-between items-center text-xs text-white/30 z-10">
        <span>&copy; 2024 Forge AI Inc.</span>
        <div className="flex gap-4">
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </div>
    </div>
  );
}
