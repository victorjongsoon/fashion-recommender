import { useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ArrowRight, MapPin, Calendar, Briefcase, Palette, ChevronDown, ChevronUp, X, Users, Hash, DollarSign } from 'lucide-react';
import type { FormData } from '../App';

interface ContextInputScreenProps {
  initialData: FormData;
  onSubmit: (data: FormData) => void;
}

const occasions = ['Casual', 'Formal', 'Sport', 'Party'];

const destinations = [
  'Tokyo', 'Seoul', 'Bangkok', 'Singapore', 'Bali',
  'Sydney', 'London', 'Paris', 'Rome', 'Barcelona',
  'Amsterdam', 'Dubai', 'Istanbul', 'New York', 'Los Angeles',
  'San Francisco', 'Miami', 'Toronto', 'Reykjavik', 'Cape Town'
];

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const categories = ['Ladieswear', 'Menswear'];

const outfitCounts = [1, 2, 3, 4, 5];

const colorMap: Record<string, string> = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Grey': '#808080',
  'Dark Blue': '#003366',
  'Light Blue': '#87CEEB',
  'Blue': '#0066CC',
  'Red': '#DC143C',
  'Dark Red': '#8B0000',
  'Pink': '#FFB6C1',
  'Light Pink': '#FFE4E1',
  'Green': '#228B22',
  'Dark Green': '#006400',
  'Yellow': '#FFD700',
  'Orange': '#FF8C00',
  'Dark Orange': '#FF4500',
  'Purple': '#9370DB',
  'Beige': '#F5F5DC',
  'Brown': '#8B4513',
  'Gold': '#FFD700',
  'Silver': '#C0C0C0',
  'Bronze/Copper': '#CD7F32',
  'Khaki Green': '#6B8E23'
};

const colorOptions = Object.keys(colorMap);
const lightColors = ['White', 'Light Blue', 'Light Pink', 'Beige', 'Yellow', 'Silver'];

export function ContextInputScreen({ initialData, onSubmit }: ContextInputScreenProps) {
  const [formData, setFormData] = useState<FormData>(initialData);
  const [showPreferredColors, setShowPreferredColors] = useState(
    initialData.preferred_colors.length > 0
  );
  const [showAvoidColors, setShowAvoidColors] = useState(
    initialData.avoid_colors.length > 0
  );

  const togglePreferredColor = (color: string) => {
    setFormData((prev) => ({
      ...prev,
      preferred_colors: prev.preferred_colors.includes(color)
        ? prev.preferred_colors.filter((c) => c !== color)
        : [...prev.preferred_colors, color]
    }));
  };

  const toggleAvoidColor = (color: string) => {
    setFormData((prev) => ({
      ...prev,
      avoid_colors: prev.avoid_colors.includes(color)
        ? prev.avoid_colors.filter((c) => c !== color)
        : [...prev.avoid_colors, color]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onSubmit(formData);
    }
  };

  const isValid =
    formData.occasion &&
    formData.destination &&
    formData.month &&
    formData.category &&
    formData.num_outfits >= 1 &&
    formData.num_outfits <= 5;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">1</div>
            <span>Your Details</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">2</div>
            <span className="text-neutral-400">Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Plan your outfit</h2>
          <p className="text-neutral-600">Tell us about your trip and style preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* ── Trip Details Section ── */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium border-b border-neutral-200 pb-2">Trip Details</h3>

            {/* Occasion */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Occasion
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {occasions.map((occasion) => (
                  <button
                    key={occasion}
                    type="button"
                    onClick={() => setFormData({ ...formData, occasion })}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      formData.occasion === occasion
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {occasion}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Destination
              </Label>
              <select
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full h-12 px-3 rounded-lg border-2 border-neutral-200 bg-white text-sm focus:outline-none focus:border-black transition-colors"
              >
                <option value="">Select a destination</option>
                {destinations.map((dest) => (
                  <option key={dest} value={dest}>{dest}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Month
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {months.map((month) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => setFormData({ ...formData, month })}
                    className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                      formData.month === month
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Style Preferences Section ── */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium border-b border-neutral-200 pb-2">Style Preferences</h3>

            {/* Category */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Category
              </Label>
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat })}
                    className={`px-6 py-3 rounded-lg border-2 transition-all ${
                      formData.category === cat
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Outfits */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Number of Outfits
              </Label>
              <div className="flex gap-2">
                {outfitCounts.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setFormData({ ...formData, num_outfits: count })}
                    className={`w-12 h-12 rounded-lg border-2 transition-all text-sm font-medium ${
                      formData.num_outfits === count
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Budget per Outfit
              </Label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={20}
                  max={500}
                  step={10}
                  value={formData.max_price}
                  onChange={(e) => setFormData({ ...formData, max_price: Number(e.target.value) })}
                  className="w-full accent-black"
                />
                <div className="flex justify-between text-sm text-neutral-500">
                  <span>$20</span>
                  <span className="font-medium text-black">${formData.max_price}</span>
                  <span>$500</span>
                </div>
              </div>
            </div>

            {/* Preferred Colors - Collapsible swatch grid */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowPreferredColors(!showPreferredColors)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  <span className="text-sm font-medium">Preferred Colors</span>
                  <span className="text-neutral-400 text-xs font-normal">(optional)</span>
                  {formData.preferred_colors.length > 0 && (
                    <span className="text-xs text-neutral-500">({formData.preferred_colors.length} selected)</span>
                  )}
                </div>
                {showPreferredColors ? (
                  <ChevronUp className="w-4 h-4 text-neutral-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                )}
              </button>

              {showPreferredColors && (
                <div className="space-y-3 pt-2">
                  {formData.preferred_colors.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, preferred_colors: [] })}
                        className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Clear all
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                    {colorOptions.map((color) => {
                      const isSelected = formData.preferred_colors.includes(color);
                      const hexColor = colorMap[color];
                      const isLight = lightColors.includes(color);

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
              )}
            </div>

            {/* Colors to Avoid - Collapsible swatch grid */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowAvoidColors(!showAvoidColors)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  <span className="text-sm font-medium">Colors to Avoid</span>
                  <span className="text-neutral-400 text-xs font-normal">(optional)</span>
                  {formData.avoid_colors.length > 0 && (
                    <span className="text-xs text-neutral-500">({formData.avoid_colors.length} selected)</span>
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
                  {formData.avoid_colors.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, avoid_colors: [] })}
                        className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Clear all
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                    {colorOptions.map((color) => {
                      const isSelected = formData.avoid_colors.includes(color);
                      const hexColor = colorMap[color];
                      const isLight = lightColors.includes(color);

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
          </div>

          <Button
            type="submit"
            disabled={!isValid}
            className="w-full bg-black hover:bg-neutral-800 text-white h-12 rounded-full"
          >
            Get Recommendations
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
}
