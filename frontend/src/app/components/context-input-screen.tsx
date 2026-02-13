import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { ArrowRight, MapPin, Calendar, Briefcase } from 'lucide-react';
import type { ContextData } from '../App';

interface ContextInputScreenProps {
  initialData: ContextData;
  onSubmit: (data: ContextData) => void;
}

const occasions = ['Casual', 'Formal', 'Sport'];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ContextInputScreen({ initialData, onSubmit }: ContextInputScreenProps) {
  const [formData, setFormData] = useState<ContextData>(initialData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.occasion && formData.destination && formData.month) {
      onSubmit(formData);
    }
  };

  const isValid = formData.occasion && formData.destination && formData.month;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">1</div>
            <span>Context</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">2</div>
            <span className="text-neutral-400">Preferences</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">3</div>
            <span className="text-neutral-400">Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Tell us about your plans</h2>
          <p className="text-neutral-600">We'll recommend outfits that match your context and weather</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Occasion
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

          <div className="space-y-3">
            <Label htmlFor="destination" className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Destination
            </Label>
            <Input
              id="destination"
              placeholder="e.g., Tokyo, Japan"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              className="h-12"
            />
          </div>

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

          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-medium">
              Additional details <span className="text-neutral-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="e.g., Business meetings in the morning, exploring the city in the evening..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-24 resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={!isValid}
            className="w-full bg-black hover:bg-neutral-800 text-white h-12 rounded-full"
          >
            Continue to Preferences
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
}
