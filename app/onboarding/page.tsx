'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FireSimple,
  X,
  ArrowRight,
  ArrowLeft,
  SpinnerGap,
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';

const QUESTIONS = [
  {
    id: 'focus',
    question: 'What do you primarily work on?',
    options: ['Visual & Graphic Design', 'Art & Illustration', 'UI/UX Design', 'Frontend Development', 'No-Code Tools', '3D/Motion Design', 'Other'],
  },
  {
    id: 'level',
    question: "What's your skill level?",
    options: ['Beginner', 'Intermediate', 'Advanced'],
  },
  {
    id: 'time',
    question: 'How much time can you dedicate weekly?',
    options: ['1-2 hours', '3-5 hours', '5+ hours'],
  },
  {
    id: 'preferences',
    question: "Any specific preferences?",
    subtitle: 'Optional question to help Forge better tailor your experience. You can always update these in Settings, as you evolve.',
    type: 'text' as const,
    placeholder: 'e.g., I prefer free tools, love tools with great tutorials, avoid subscription-only services',
  },
  {
    id: 'existing_tools',
    question: "Share some tools you've enjoyed or been meaning to try",
    subtitle: 'Optional question to help Forge better tailor your experience. You can always update these in Settings, as you evolve.',
    type: 'text' as const,
    placeholder: 'e.g., Figma, Framer, Midjourney, Runway — you can also drop a link!',
  },
  {
    id: 'goal',
    question: 'What do you want to achieve in 4 weeks?',
    subtitle: 'Optional question to help Forge better tailor your experience. You can always update these in Settings, as you evolve.',
    type: 'text' as const,
    placeholder: 'e.g., Learn 3D design for web projects',
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user, profile, updateProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/signup');
      } else if (!profile?.name) {
        router.push('/auth/profile-setup');
      } else if (profile?.onboarding_completed) {
        router.push('/dashboard');
      }
    }
  }, [user, profile, authLoading, router]);

  const currentQuestion = QUESTIONS[step];
  const totalSteps = QUESTIONS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const saveOnboarding = async (finalAnswers: Record<string, string>) => {
    setSaving(true);

    if (typeof window !== 'undefined') {
      localStorage.setItem('userProfile', JSON.stringify(finalAnswers));
    }

    try {
      // Save preferences to the user profile
      await updateProfile({
        onboarding_completed: true,
      });

      // Build a readable summary for Gemini's memory
      const lines = [
        `Focus: ${finalAnswers.focus || 'Not specified'}`,
        `Skill Level: ${finalAnswers.level || 'Not specified'}`,
        `Weekly Time: ${finalAnswers.time || 'Not specified'}`,
        finalAnswers.preferences ? `Preferences: ${finalAnswers.preferences}` : null,
        finalAnswers.existing_tools ? `Tools: ${finalAnswers.existing_tools}` : null,
        finalAnswers.goal ? `Goal: ${finalAnswers.goal}` : null,
      ].filter(Boolean).join('\n');

      // Save to persistent memory (correct payload format for /api/memories)
      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          section: 'User Profile',
          content: lines,
        }),
      }).catch(() => {});

      // If user chose "Other" for focus, save extra context so Gemini understands their niche
      if (finalAnswers.focus && !['Visual & Graphic Design', 'Art & Illustration', 'UI/UX Design', 'Frontend Development', 'No-Code Tools', '3D/Motion Design'].includes(finalAnswers.focus)) {
        await fetch('/api/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id,
            section: 'Custom Focus Area',
            content: `User works in "${finalAnswers.focus}" — this is outside the standard categories. Tailor tool recommendations and project ideas to this specific domain. Ask follow-up questions to understand their workflow better.`,
          }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error saving onboarding:', error);
    }

    setSaving(false);
    router.push('/dashboard');
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setSelectedOption(null);
    setOtherText('');

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      saveOnboarding(newAnswers);
    }
  };

  if (authLoading || saving) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-royal">
        <SpinnerGap className="animate-spin text-phoenix" size={40} />
      </div>
    );
  }

  const handleContinue = () => {
    if (currentQuestion.type === 'text') {
      handleAnswer(answers[currentQuestion.id] || '');
    } else if (selectedOption === 'Other') {
      handleAnswer(otherText.trim() || 'Other');
    } else if (selectedOption) {
      handleAnswer(selectedOption);
    }
  };

  return (
    <div className="w-full h-screen flex bg-royal fade-in">
      {/* Left Panel */}
      <div className="w-1/3 bg-maiden hidden md:flex flex-col justify-between p-12 text-magnolia relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-10 h-10 rounded-full bg-phoenix flex items-center justify-center text-white mb-8">
            <FireSimple size={24} weight="fill" />
          </div>
          <h2 className="font-serif text-4xl leading-tight mb-6 text-white">
            &ldquo;The best way to predict the future is to create it.&rdquo;
          </h2>
          <p className="text-white/50 font-mono text-sm">&mdash; Peter Drucker</p>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-chartreuse/20 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-[-50px] w-48 h-48 bg-phoenix/20 rounded-full blur-[60px]" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-24 relative bg-royal">
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-8">
            <span className="text-xs font-bold tracking-widest text-white/40 uppercase">
              {String(step + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
            </span>
            <a href="/" className="text-white/40 hover:text-white transition-colors">
              <X size={20} />
            </a>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/10 rounded-full mb-12">
            <div
              className="h-full bg-phoenix rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <h3 className="text-3xl font-serif text-white mb-3 slide-in" key={`q-${step}`}>
            {currentQuestion.question}
          </h3>

          {'subtitle' in currentQuestion && currentQuestion.subtitle && (
            <p className="text-white/40 text-sm mb-8">{currentQuestion.subtitle}</p>
          )}

          {!('subtitle' in currentQuestion) && <div className="mb-8" />}

          {currentQuestion.type === 'text' ? (
            <div className="slide-in" key={`a-${step}`}>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white mb-6 min-h-32 focus:outline-none focus:border-phoenix focus:ring-1 focus:ring-phoenix transition-all resize-none placeholder:text-white/30"
                placeholder={currentQuestion.placeholder}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-3 mb-8 slide-in" key={`a-${step}`}>
              {currentQuestion.options?.map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all group ${
                    selectedOption === option
                      ? 'border-phoenix bg-phoenix/10'
                      : 'border-white/10 hover:border-phoenix/50 hover:bg-white/5'
                  }`}
                  onClick={() => { setSelectedOption(option); if (option !== 'Other') setOtherText(''); }}
                >
                  <input
                    type="radio"
                    name="onboarding"
                    checked={selectedOption === option}
                    onChange={() => { setSelectedOption(option); if (option !== 'Other') setOtherText(''); }}
                    className="w-5 h-5 text-phoenix border-white/20 focus:ring-phoenix accent-phoenix"
                  />
                  <span className="ml-4 text-lg text-white/80 group-hover:text-white font-medium">{option}</span>
                </label>
              ))}

              {/* Other text input */}
              {selectedOption === 'Other' && (
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Tell us what you work on..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-phoenix transition-colors mt-2"
                  autoFocus
                />
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            {step > 0 ? (
              <button
                onClick={() => { setStep(step - 1); setSelectedOption(null); setOtherText(''); }}
                className="text-white/40 hover:text-white transition-colors text-sm font-medium flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-phoenix text-white font-medium rounded-full hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              {step === QUESTIONS.length - 1 ? 'Finish Setup' : 'Continue'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
