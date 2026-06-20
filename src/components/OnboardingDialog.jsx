import { useState } from 'react';
import { X, Dumbbell, TrendingUp, Trophy, ChevronRight, SkipForward } from 'lucide-react';

export default function OnboardingDialog({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Track Your Workouts',
      description: 'Log every set, rep, and weight to keep track of your progress.',
    },
    {
      title: 'View Analytics',
      description: 'See your volume trends, muscle balance, and estimated 1RM over time.',
    },
    {
      title: 'Personal Records',
      description: 'Celebrate your PRs and track your strength gains for each exercise.',
    },
  ];

  const getIcon = (index) => {
    if (index === 0) return <Dumbbell size={36} className="text-app-bg" />;
    if (index === 1) return <TrendingUp size={36} className="text-app-bg" />;
    return <Trophy size={36} className="text-app-bg" />;
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 pb-20">
      <div className="w-full max-w-md glass-card rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx <= currentStep ? 'w-8 bg-accent-lime' : 'w-2 bg-card-elevated'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="grid h-10 w-10 place-items-center rounded-xl bg-app-bg text-text-muted hover:text-text-main transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="text-center py-8">
          <div className="mx-auto mb-6 h-20 w-20 grid place-items-center rounded-[24px] glass-card-lime">
            {getIcon(currentStep)}
          </div>
          <h2 className="text-2xl font-extrabold text-text-main mb-3">
            {steps[currentStep].title}
          </h2>
          <p className="text-sm text-text-muted">
            {steps[currentStep].description}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 h-14 rounded-xl bg-card-elevated text-text-muted font-bold text-lg flex items-center justify-center gap-2 transition active:scale-95"
          >
            <SkipForward size={20} />
            Skip
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 h-14 rounded-xl glass-card-lime text-app-bg font-bold text-lg flex items-center justify-center gap-2 hover:shadow-glow-lime transition active:scale-95"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
