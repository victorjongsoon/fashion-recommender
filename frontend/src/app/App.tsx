import { useState } from 'react';
import { LandingScreen } from './components/landing-screen';
import { ContextInputScreen } from './components/context-input-screen';
import { RecommendationScreen } from './components/recommendation-screen';

export type KgInput = {
  occasion: string;
  category: string;
  num_outfits: number;
  max_price: number;
  preferred_colors: string[];
  avoid_colors: string[];
  season?: string;
  // extra context for display
  gender: string;
  destination: string;
  month: string;
  avg_temp_c: number;
  rain_prob: number;
};

export type FormData = {
  occasion: string;
  destination: string;
  month: string;
  category: string;
  num_outfits: number;
  max_price: number;
  preferred_colors: string[];
  avoid_colors: string[];
  season?: string;
  kg_inputs?: KgInput[];   // ← multiple trip combos from chatbot
};

export default function App() {
  const [step, setStep] = useState<'landing' | 'form' | 'recommendation'>('landing');
  const [formData, setFormData] = useState<FormData>({
    occasion: '',
    destination: '',
    month: '',
    category: '',
    num_outfits: 3,
    max_price: 100,
    preferred_colors: [],
    avoid_colors: [],
  });

  const handleStart = () => setStep('form');

  const handleFormSubmit = (data: FormData) => {
    setFormData(data);
    setStep('recommendation');
  };

  const handleRegenerate  = () => setFormData({ ...formData });
  const handleAdjustPreferences = () => setStep('form');

  const handleStartOver = () => {
    setStep('landing');
    setFormData({
      occasion: '', destination: '', month: '', category: '',
      num_outfits: 3, max_price: 100, preferred_colors: [], avoid_colors: [],
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {step === 'landing' && <LandingScreen onStart={handleStart} />}
      {step === 'form' && (
        <ContextInputScreen initialData={formData} onSubmit={handleFormSubmit} />
      )}
      {step === 'recommendation' && (
        <RecommendationScreen
          formData={formData}
          onRegenerate={handleRegenerate}
          onAdjustPreferences={handleAdjustPreferences}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}
