import { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ArrowRight, ArrowLeft, Palette, Shield, ChevronDown, ChevronUp, X } from 'lucide-react';
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

// Map color names to actual colors for visual swatches
const colorMap: Record<string, string> = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Grey': '#808080',
  'Blue': '#0066CC',
  'Dark Blue': '#003366',
  'Light Blue': '#87CEEB',
  'Red': '#DC143C',
  'Dark Red': '#8B0000',
  'Pink': '#FFB6C1',
  'Dark Pink': '#C71585',
  'Green': '#228B22',
  'Dark Green': '#006400',
  'Light Green': '#90EE90',
  'Yellow': '#FFD700',
  'Orange': '#FF8C00',
  'Dark Orange': '#FF4500',
  'Purple': '#9370DB',
  'Dark Purple': '#4B0082',
  'Beige': '#F5F5DC',
  'Brown': '#8B4513',
  'Gold': '#FFD700',
  'Silver': '#C0C0C0'
};

const colorOptions = Object.keys(colorMap);

export function PreferenceScreen({ initialData, contextData, onSubmit, onBack }: PreferenceScreenProps) {
  const [preferences, setPreferences] = useState<PreferenceData>(initialData);
  const [showAvoidColors, setShowAvoidColors] = useState(false);

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

  const clearPreferredColors = () => {
    setPreferences((prev) => ({ ...prev, preferred_colors: [] }));
  };

  const clearAvoidColors = () => {
    setPreferences((prev) => ({ ...prev, avoid_colors: [] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(preferences);
  };

  const isValid = preferences.segment !== undefined;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">1</div>
            <span className="text-neutral-400">Context</span>
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">2</div>
            <span>Preferences</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">3</div>
            <span className="text-neutral-400">Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Define your preferences</h2>
          <p className="text-neutral-600 text-sm">
            {contextData.destination && `For your ${contextData.occasion.toLowerCase()} in ${contextData.destination}`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Gender / Segment Selection */}
          <div className="space-y-3">
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
                  className={`px-4 py-2 rounded-full border-2 transition-all text-sm ${
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Preferred Colors
                {preferences.preferred_colors && preferences.preferred_colors.length > 0 && (
                  <span className="text-xs text-neutral-500">({preferences.preferred_colors.length} selected)</span>
                )}
              </Label>
              {preferences.preferred_colors && preferences.preferred_colors.length > 0 && (
                <button
                  type="button"
                  onClick={clearPreferredColors}
                  className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
              {colorOptions.map((color) => {
                const isSelected = preferences.preferred_colors?.includes(color);
                const hexColor = colorMap[color];
                const isLight = ['White', 'Light Blue', 'Light Green', 'Beige', 'Yellow', 'Pink', 'Light Pink', 'Silver'].includes(color);
                
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => togglePreferredColor(color)}
                    aria-label={color}
                    title={color}
                    className={`w-10 h-10 rounded-full transition-all ${
                      isSelected
                        ? 'ring-4 ring-green-500 ring-offset-2 scale-110'
                        : 'ring-2 ring-neutral-300 hover:ring-neutral-400 hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: hexColor,
                      border: isLight ? '1px solid #e5e5e5' : 'none'
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Colors to Avoid - Collapsible */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAvoidColors(!showAvoidColors)}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <span className="text-sm font-medium">Colors to Avoid</span>
                {preferences.avoid_colors && preferences.avoid_colors.length > 0 && (
                  <span className="text-xs text-neutral-500">({preferences.avoid_colors.length} selected)</span>
                )}
              </div>
              {showAvoidColors ? (
                <ChevronUp className="w-4 h-4 text-neutral-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              )}
            </button>
            
            {showAvoidColors && (
              <div className="space-y-3 pt-2">
                {preferences.avoid_colors && preferences.avoid_colors.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={clearAvoidColors}
                      className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Clear all
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                  {colorOptions.map((color) => {
                    const isSelected = preferences.avoid_colors?.includes(color);
                    const hexColor = colorMap[color];
                    const isLight = ['White', 'Light Blue', 'Light Green', 'Beige', 'Yellow', 'Pink', 'Light Pink', 'Silver'].includes(color);
                    
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => toggleAvoidColor(color)}
                        aria-label={`Avoid ${color}`}
                        title={color}
                        className={`w-10 h-10 rounded-full transition-all relative ${
                          isSelected
                            ? 'ring-4 ring-red-500 ring-offset-2 scale-110'
                            : 'ring-2 ring-neutral-300 hover:ring-neutral-400 hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: hexColor,
                          border: isLight ? '1px solid #e5e5e5' : 'none'
                        }}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <X className="w-5 h-5 text-white drop-shadow-lg" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
