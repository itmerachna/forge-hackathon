'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ArrowRight,
  ArrowLeft,
  SpinnerGap,
} from '@phosphor-icons/react';
import Image from 'next/image';
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
      await updateProfile({
        onboarding_completed: true,
      });

      const lines = [
        `Focus: ${finalAnswers.focus || 'Not specified'}`,
        `Skill Level: ${finalAnswers.level || 'Not specified'}`,
        `Weekly Time: ${finalAnswers.time || 'Not specified'}`,
        finalAnswers.preferences ? `Preferences: ${finalAnswers.preferences}` : null,
        finalAnswers.existing_tools ? `Tools: ${finalAnswers.existing_tools}` : null,
        finalAnswers.goal ? `Goal: ${finalAnswers.goal}` : null,
      ].filter(Boolean).join('\n');

      await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          section: 'User Profile',
          content: lines,
        }),
      }).catch(() => {});

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
    <div className="w-full h-screen flex bg-royal fade-in relative overflow-hidden">
      {/* Background gradients — matches home page */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-maiden/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-phoenix/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Left Panel */}
      <div className="w-[38%] hidden md:flex flex-col justify-center p-12 relative z-10">
        <div>
          <div className="mb-8">
            <Image src="/forge-logo.svg" alt="Forge" width={120} height={48} />
          </div>
          <h2 className="font-serif text-4xl leading-tight mb-6 text-white">
            &ldquo;The best way to predict the future is to create it.&rdquo;
          </h2>
          <p className="text-white/50 font-mono text-sm">&mdash; Peter Drucker</p>
        </div>
      </div>

      {/* Subtle divider */}
      <div className="hidden md:block w-px bg-white/50" />

      {/* Right Panel */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        {/* Fixed header: step counter + progress */}
        <div className="px-8 md:px-16 pt-8">
          <div className="w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold tracking-widest text-white/40 uppercase">
                {String(step + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
              </span>
              <a href="/" className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </a>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full">
              <div
                className="h-full bg-phoenix rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content area — fixed position for question, scrollable options */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 pb-8">
          <div className="w-full max-w-lg">
            <h3 className="text-2xl font-serif text-white mb-2 slide-in" key={`q-${step}`}>
              {currentQuestion.question}
            </h3>

            {'subtitle' in currentQuestion && currentQuestion.subtitle && (
              <p className="text-white/40 text-sm mb-6">{currentQuestion.subtitle}</p>
            )}

            {!('subtitle' in currentQuestion) && <div className="mb-6" />}

            {currentQuestion.type === 'text' ? (
              <div className="slide-in" key={`a-${step}`}>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white mb-4 min-h-24 focus:outline-none focus:border-phoenix focus:ring-1 focus:ring-phoenix transition-all resize-none placeholder:text-white/30"
                  placeholder={currentQuestion.placeholder}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-2 mb-4 slide-in" key={`a-${step}`}>
                {currentQuestion.options?.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all group ${
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
                      className="w-4 h-4 text-phoenix border-white/20 focus:ring-phoenix accent-phoenix"
                    />
                    <span className="ml-3 text-sm text-white/80 group-hover:text-white font-medium">{option}</span>
                  </label>
                ))}

                {selectedOption === 'Other' && (
                  <input
                    type="text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Tell us what you work on..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-phoenix transition-colors mt-1"
                    autoFocus
                  />
                )}
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
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
                className="px-6 py-2.5 bg-phoenix text-white font-medium rounded-full hover:bg-orange-600 transition-colors flex items-center gap-2 text-sm"
              >
                {step === QUESTIONS.length - 1 ? 'Finish Setup' : 'Continue'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
