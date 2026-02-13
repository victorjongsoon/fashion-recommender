import { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ArrowRight, ArrowLeft, Palette, Shield } from 'lucide-react';
import type { PreferenceData, ContextData } from '../App';

interface PreferenceScreenProps {
  initialData: PreferenceData;
  contextData: ContextData;
  onSubmit: (data: PreferenceData) => void;
  onBack: () => void;
}

const segmentOptions = [
  { value: 'menswear', label: 'Menswear' },
  { value: 'ladieswear', label: 'Ladieswear' },
  { value: 'sport', label: 'Sport' },
];

const colorOptions = [
  'Black', 'White', 'Grey', 'Blue', 'Dark Blue', 'Light Blue',
  'Red', 'Dark Red', 'Pink', 'Dark Pink',
  'Green', 'Dark Green', 'Light Green',
  'Yellow', 'Orange', 'Dark Orange',
  'Purple', 'Dark Purple',
  'Beige', 'Brown', 'Gold', 'Silver'
];

export function PreferenceScreen({ initialData, contextData, onSubmit, onBack }: PreferenceScreenProps) {
  const [preferences, setPreferences] = useState<PreferenceData>(initialData);

  const setSegment = (segment: string) => {
    setPreferences((prev) => ({
      ...prev,
      segment: prev.segment === segment ? undefined : segment
    }));
  };

  const togglePreferredColor = (color: string) => {
    setPreferences((prev) => {
      const current = prev.preferred_colors || [];
      return {
        ...prev,
        preferred_colors: current.includes(color)
          ? current.filter((c) => c !== color)
          : [...current, color]
      };
    });
  };

  const toggleAvoidColor = (color: string) => {
    setPreferences((prev) => {
      const current = prev.avoid_colors || [];
      return {
        ...prev,
        avoid_colors: current.includes(color)
          ? current.filter((c) => c !== color)
          : [...current, color]
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(preferences);
  };

  const isValid = preferences.segment !== undefined;

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
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Define your preferences</h2>
          <p className="text-neutral-600">
            {contextData.destination && `For your ${contextData.occasion.toLowerCase()} in ${contextData.destination}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Gender / Segment Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Gender / Segment
            </Label>
            <div className="flex flex-wrap gap-2">
              {segmentOptions.map((segment) => (
                <button
                  key={segment.value}
                  type="button"
                  onClick={() => setSegment(segment.value)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    preferences.segment === segment.value
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  {segment.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Colors */}
          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Preferred Colors
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => togglePreferredColor(color)}
                  className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                    preferences.preferred_colors?.includes(color)
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Colors to Avoid */}
          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Colors to Avoid
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => toggleAvoidColor(color)}
                  className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                    preferences.avoid_colors?.includes(color)
                      ? 'border-red-500 bg-red-50 text-red-900'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  {color}
                </button>
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
