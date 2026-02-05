import { useState } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { ArrowRight, ArrowLeft, Sparkles, Shield, Thermometer } from 'lucide-react';
import type { PreferenceData, ContextData } from '../App';

interface PreferenceScreenProps {
  initialData: PreferenceData;
  contextData: ContextData;
  onSubmit: (data: PreferenceData) => void;
  onBack: () => void;
}

const styleOptions = [
  { value: 'casual', label: 'Casual' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'elegant', label: 'Elegant' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'professional', label: 'Professional' },
];

const constraintOptions = [
  { value: 'prefer-pants', label: 'Prefer pants over skirts' },
  { value: 'avoid-skirts', label: 'Avoid skirts' },
  { value: 'avoid-dresses', label: 'Avoid dresses' },
  { value: 'layering-allowed', label: 'Layering allowed' },
  { value: 'neutral-colors', label: 'Neutral colors only' },
];

const comfortOptions = [
  { value: 'extra-warmth', label: 'Extra warmth' },
  { value: 'loose-fit', label: 'Loose fit' },
  { value: 'breathable', label: 'Breathable fabrics' },
  { value: 'waterproof', label: 'Waterproof options' },
];

export function PreferenceScreen({ initialData, contextData, onSubmit, onBack }: PreferenceScreenProps) {
  const [preferences, setPreferences] = useState<PreferenceData>(initialData);

  const toggleStyle = (style: string) => {
    setPreferences((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style]
    }));
  };

  const toggleConstraint = (constraint: string) => {
    setPreferences((prev) => ({
      ...prev,
      constraints: prev.constraints.includes(constraint)
        ? prev.constraints.filter((c) => c !== constraint)
        : [...prev.constraints, constraint]
    }));
  };

  const toggleComfort = (comfort: string) => {
    setPreferences((prev) => ({
      ...prev,
      comfort: prev.comfort.includes(comfort)
        ? prev.comfort.filter((c) => c !== comfort)
        : [...prev.comfort, comfort]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(preferences);
  };

  const isValid = preferences.styles.length > 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">1</div>
            <span className="text-neutral-400">Context</span>
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">2</div>
            <span>Preferences</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">3</div>
            <span className="text-neutral-400">Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Define your style</h2>
          <p className="text-neutral-600">
            {contextData.destination && `For your ${contextData.occasion.toLowerCase()} in ${contextData.destination}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Style Preferences
            </Label>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => toggleStyle(style.value)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    preferences.styles.includes(style.value)
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Clothing Constraints
            </Label>
            <div className="space-y-3">
              {constraintOptions.map((constraint) => (
                <div key={constraint.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={constraint.value}
                    checked={preferences.constraints.includes(constraint.value)}
                    onCheckedChange={() => toggleConstraint(constraint.value)}
                  />
                  <label
                    htmlFor={constraint.value}
                    className="text-sm cursor-pointer select-none"
                  >
                    {constraint.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Comfort Preferences
            </Label>
            <div className="space-y-3">
              {comfortOptions.map((comfort) => (
                <div key={comfort.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={comfort.value}
                    checked={preferences.comfort.includes(comfort.value)}
                    onCheckedChange={() => toggleComfort(comfort.value)}
                  />
                  <label
                    htmlFor={comfort.value}
                    className="text-sm cursor-pointer select-none"
                  >
                    {comfort.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className="flex-1 h-12 rounded-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              className="flex-1 bg-black hover:bg-neutral-800 text-white h-12 rounded-full"
            >
              Get Recommendations
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
