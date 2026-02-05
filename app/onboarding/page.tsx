'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plant,
  X,
  ArrowRight,
} from '@phosphor-icons/react';

const QUESTIONS = [
  {
    id: 'focus',
    question: 'What do you primarily work on?',
    options: ['Web Design', 'UI/UX Design', 'Frontend Development', 'No-Code Tools', '3D/Motion Design']
  },
  {
    id: 'level',
    question: "What's your skill level?",
    options: ['Beginner', 'Intermediate', 'Advanced']
  },
  {
    id: 'time',
    question: 'How much time can you dedicate weekly?',
    options: ['1-2 hours', '3-5 hours', '5+ hours']
  },
  {
    id: 'preferences',
    question: "Any specific preferences?",
    type: 'text' as const,
    placeholder: 'e.g., I prefer free tools, love tools with great tutorials, avoid subscription-only services'
  },
  {
    id: 'existing_tools',
    question: "Share some tools you've enjoyed or been meaning to try",
    type: 'text' as const,
    placeholder: 'e.g., Figma, Framer, Midjourney, Runway'
  },
  {
    id: 'goal',
    question: 'What do you want to achieve in 4 weeks?',
    type: 'text' as const,
    placeholder: 'e.g., Learn 3D design for web projects'
  }
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const router = useRouter();

  const currentQuestion = QUESTIONS[step];
  const totalSteps = QUESTIONS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const handleAnswer = (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('userProfile', JSON.stringify(newAnswers));
      }
      router.push('/dashboard');
    }
  };

  const handleContinue = () => {
    if (currentQuestion.type === 'text') {
      handleAnswer(answers[currentQuestion.id] || '');
    } else if (selectedOption) {
      handleAnswer(selectedOption);
    }
  };

  return (
    <div className="w-full h-screen flex bg-light fade-in">
      {/* Left Panel */}
      <div className="w-1/3 bg-maiden hidden md:flex flex-col justify-between p-12 text-magnolia relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-10 h-10 rounded-full bg-chartreuse flex items-center justify-center text-royal mb-8">
            <Plant size={24} />
          </div>
          <h2 className="font-serif text-4xl leading-tight mb-6">
            &ldquo;The best way to predict the future is to create it.&rdquo;
          </h2>
          <p className="text-white/50 font-mono text-sm">&mdash; Peter Drucker</p>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-chartreuse/20 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-[-50px] w-48 h-48 bg-phoenix/20 rounded-full blur-[60px]" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-24 relative">
        <div className="w-full max-w-lg">
          <div className="flex justify-between items-center mb-8">
            <span className="text-xs font-bold tracking-widest text-maiden/40 uppercase">
              Step {String(step + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
            </span>
            <a href="/" className="text-royal/40 hover:text-royal transition-colors">
              <X size={20} />
            </a>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full mb-12">
            <div
              className="h-full bg-phoenix rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <h3 className="text-3xl font-serif text-royal mb-8 slide-in" key={`q-${step}`}>
            {currentQuestion.question}
          </h3>

          {currentQuestion.type === 'text' ? (
            <div className="slide-in" key={`a-${step}`}>
              <textarea
                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-royal mb-6 min-h-32 focus:outline-none focus:border-phoenix focus:ring-1 focus:ring-phoenix transition-all resize-none"
                placeholder={currentQuestion.placeholder}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-4 mb-12 slide-in" key={`a-${step}`}>
              {currentQuestion.options?.map((option) => (
                <label
                  key={option}
                  className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all group ${
                    selectedOption === option
                      ? 'border-phoenix bg-orange-50/50'
                      : 'border-gray-200 hover:border-phoenix hover:bg-orange-50/30'
                  }`}
                  onClick={() => setSelectedOption(option)}
                >
                  <input
                    type="radio"
                    name="onboarding"
                    checked={selectedOption === option}
                    onChange={() => setSelectedOption(option)}
                    className="w-5 h-5 text-phoenix border-gray-300 focus:ring-phoenix accent-phoenix"
                  />
                  <span className="ml-4 text-lg text-royal/80 group-hover:text-royal font-medium">{option}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            {step > 0 ? (
              <button
                onClick={() => { setStep(step - 1); setSelectedOption(null); }}
                className="text-royal/40 hover:text-royal transition-colors text-sm font-medium"
              >
                &larr; Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-royal text-white font-medium rounded-full hover:bg-maiden transition-colors flex items-center gap-2"
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
