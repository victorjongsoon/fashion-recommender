import { useState } from 'react';
import { LandingScreen } from './components/landing-screen';
import { ContextInputScreen } from './components/context-input-screen';
import { PreferenceScreen } from './components/preference-screen';
import { RecommendationScreen } from './components/recommendation-screen';

export type ContextData = {
  occasion: string;
  destination: string;
  month: string;
  description: string;
};

export type PreferenceData = {
  segment?: string; // 'menswear' | 'ladieswear' | 'sport'
  preferred_colors?: string[];
  avoid_colors?: string[];
};

export default function App() {
  const [step, setStep] = useState<'landing' | 'context' | 'preference' | 'recommendation'>('landing');
  const [contextData, setContextData] = useState<ContextData>({
    occasion: '',
    destination: '',
    month: '',
    description: ''
  });
  const [preferenceData, setPreferenceData] = useState<PreferenceData>({
    segment: undefined,
    preferred_colors: [],
    avoid_colors: []
  });

  const handleStart = () => {
    setStep('context');
  };

  const handleContextSubmit = (data: ContextData) => {
    setContextData(data);
    setStep('preference');
  };

  const handlePreferenceSubmit = (data: PreferenceData) => {
    setPreferenceData(data);
    setStep('recommendation');
  };

  const handleRegenerate = () => {
    // Trigger regeneration by re-rendering with updated timestamp
    setPreferenceData({ ...preferenceData });
  };

  const handleAdjustPreferences = () => {
    setStep('preference');
  };

  const handleStartOver = () => {
    setStep('landing');
    setContextData({
      occasion: '',
      destination: '',
      month: '',
      description: ''
    });
    setPreferenceData({
      segment: undefined,
      preferred_colors: [],
      avoid_colors: []
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {step === 'landing' && <LandingScreen onStart={handleStart} />}
      {step === 'context' && (
        <ContextInputScreen 
          initialData={contextData}
          onSubmit={handleContextSubmit} 
        />
      )}
      {step === 'preference' && (
        <PreferenceScreen 
          initialData={preferenceData}
          contextData={contextData}
          onSubmit={handlePreferenceSubmit}
          onBack={() => setStep('context')}
        />
      )}
      {step === 'recommendation' && (
        <RecommendationScreen 
          contextData={contextData}
          preferenceData={preferenceData}
          onRegenerate={handleRegenerate}
          onAdjustPreferences={handleAdjustPreferences}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}
