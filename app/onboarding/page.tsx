'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    id: 'goal',
    question: 'What do you want to achieve in 4 weeks?',
    type: 'text',
    placeholder: 'e.g., Learn 3D design for web projects'
  }
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const router = useRouter();
  
  const currentQuestion = QUESTIONS[step];
  
  const handleAnswer = (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem('userProfile', JSON.stringify(newAnswers));
      }
      router.push('/dashboard');
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            {QUESTIONS.map((_, i) => (
              <div 
                key={i}
                className={`h-2 flex-1 rounded ${i <= step ? 'bg-orange-500' : 'bg-gray-700'}`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-400">Question {step + 1} of {QUESTIONS.length}</p>
        </div>
        
        <h2 className="text-3xl font-bold mb-8">{currentQuestion.question}</h2>
        
        {currentQuestion.type === 'text' ? (
          <div>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white mb-4 min-h-32"
              placeholder={currentQuestion.placeholder}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
            />
            <button
              onClick={() => handleAnswer(answers[currentQuestion.id] as string || '')}
              className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-lg font-semibold transition"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentQuestion.options?.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500 rounded-lg p-4 transition"
              >
                {option}
              </button>
            ))}
          </div>
        )}
        
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="mt-6 text-gray-400 hover:text-white transition"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
