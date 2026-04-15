import { Button } from './ui/button';
import { Sparkles } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
}

export function LandingScreen({ onStart }: LandingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-neutral-50">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-black mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-light tracking-tight">
            Outfit Planner
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 max-w-lg mx-auto">
            Get personalized outfit recommendations based on your travel plans, weather, and style preferences
          </p>
        </div>

        <div className="space-y-4 pt-8">
          <Button 
            onClick={onStart}
            size="lg"
            className="bg-black hover:bg-neutral-800 text-white px-12 py-6 text-lg h-auto rounded-full"
          >
            Plan Your Outfit
          </Button>
          
          <div className="flex flex-wrap justify-center gap-6 pt-8 text-sm text-neutral-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-400"></div>
              <span>Weather-aware</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-400"></div>
              <span>Style-matched</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-400"></div>
              <span>Context-specific</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
