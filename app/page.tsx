export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <nav className="p-6 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-2xl">
            🔨
          </div>
          <h1 className="text-2xl font-bold">Forge</h1>
        </div>
      </nav>
      
      <main className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Forge your craft,<br/>one tool at a time
        </h1>
        
        <p className="text-xl text-gray-300 mb-8 max-w-2xl">
          Stop bookmarking tools you'll never try. 
          Start building skills that actually stick.
        </p>
        
        <a 
          <button 
          onClick={() => {
            if (typeof window !== 'undefined') {
              const profile = localStorage.getItem('userProfile');
              window.location.href = profile ? '/dashboard' : '/onboarding';
            }
          }}
          className="bg-orange-500 hover:bg-orange-600 px-8 py-4 rounded-lg text-lg font-semibold inline-block transition cursor-pointer"
        >
          Start Forging
        </button>
        </a>
        
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
            <h3 className="text-3xl font-bold mb-2">1️⃣</h3>
            <h4 className="font-semibold text-lg mb-2">Weekly Tools</h4>
            <p className="text-gray-400">AI curates 5-10 tools tailored to your goals</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
            <h3 className="text-3xl font-bold mb-2">2️⃣</h3>
            <h4 className="font-semibold text-lg mb-2">Daily Accountability</h4>
            <p className="text-gray-400">Your coach checks in to keep you motivated</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
            <h3 className="text-3xl font-bold mb-2">3️⃣</h3>
            <h4 className="font-semibold text-lg mb-2">Track Progress</h4>
            <p className="text-gray-400">See your growth with projects you've built</p>
          </div>
        </div>
      </main>
    </div>
  );
}
