import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { RefreshCw, Settings, Home, ChevronDown, ChevronUp } from 'lucide-react';
import type { ContextData, PreferenceData } from '../App';

interface RecommendationScreenProps {
  contextData: ContextData;
  preferenceData: PreferenceData;
  onRegenerate: () => void;
  onAdjustPreferences: () => void;
  onStartOver: () => void;
}

type OutfitItem = {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'outerwear' | 'dress';
  image: string;
};

type Outfit = {
  id: string;
  name: string;
  items: OutfitItem[];
  explanation: string;
  tags: string[];
};

// Mock outfit data
const generateOutfits = (contextData: ContextData, preferenceData: PreferenceData): Outfit[] => {
  const isWinter = ['January', 'February', 'March', 'November', 'December'].includes(contextData.month);
  const isSummer = ['June', 'July', 'August'].includes(contextData.month);
  const styles = preferenceData.styles;
  
  const outfits: Outfit[] = [
    {
      id: '1',
      name: 'Layered Minimalist',
      items: [
        {
          id: 't1',
          name: 'Merino Wool Sweater',
          type: 'top',
          image: 'https://images.unsplash.com/photo-1633117876849-764eb32d54e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXN1YWwlMjBzd2VhdGVyJTIwY2xvdGhpbmclMjBpdGVtJTIwd2hpdGUlMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3MDI2NTMxMnww&ixlib=rb-4.1.0&q=80&w=400'
        },
        {
          id: 'b1',
          name: 'Dark Wash Denim',
          type: 'bottom',
          image: 'https://images.unsplash.com/photo-1718252540511-e958742e4165?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZW5pbSUyMGplYW5zJTIwcGFudHMlMjB3aGl0ZSUyMGJhY2tncm91bmR8ZW58MXx8fHwxNzcwMjY1MzEzfDA&ixlib=rb-4.1.0&q=80&w=400'
        },
        ...(isWinter ? [{
          id: 'o1',
          name: 'Wool Overcoat',
          type: 'outerwear' as const,
          image: 'https://images.unsplash.com/photo-1684841565198-41e4887476f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW50ZXIlMjBjb2F0JTIwamFja2V0JTIwY2xvdGhpbmclMjB3aGl0ZSUyMGJhY2tncm91bmR8ZW58MXx8fHwxNzcwMjY1MzEzfDA&ixlib=rb-4.1.0&q=80&w=400'
        }] : [])
      ],
      explanation: isWinter 
        ? `Perfect for ${contextData.month} in ${contextData.destination}. The wool sweater provides warmth while the overcoat protects against cold winds. Minimal and functional.`
        : `Clean and versatile for ${contextData.occasion.toLowerCase()} occasions. The neutral tones work well for ${contextData.destination}, offering comfort and style.`,
      tags: ['Minimal', 'Comfortable', 'Versatile']
    },
    {
      id: '2',
      name: 'Smart Casual',
      items: [
        {
          id: 't2',
          name: 'Structured Blazer',
          type: 'top',
          image: 'https://images.unsplash.com/photo-1547587091-d639c1c338b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwZmFzaGlvbiUyMG91dGZpdCUyMGNsb3RoaW5nJTIwd2hpdGUlMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3MDI2NTMxMXww&ixlib=rb-4.1.0&q=80&w=400'
        },
        {
          id: 'b2',
          name: 'Tailored Trousers',
          type: 'bottom',
          image: 'https://images.unsplash.com/photo-1718252540511-e958742e4165?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZW5pbSUyMGplYW5zJTIwcGFudHMlMjB3aGl0ZSUyMGJhY2tncm91bmR8ZW58MXx8fHwxNzcwMjY1MzEzfDA&ixlib=rb-4.1.0&q=80&w=400'
        }
      ],
      explanation: `Ideal for ${contextData.occasion.toLowerCase()} settings. This combination strikes the perfect balance between professional and relaxed, suitable for the climate in ${contextData.destination}.`,
      tags: ['Professional', 'Polished', 'Flexible']
    },
    {
      id: '3',
      name: 'Elegant Evening',
      items: [
        {
          id: 'd1',
          name: 'Silk Midi Dress',
          type: 'dress',
          image: 'https://images.unsplash.com/photo-1741653216863-c3e2c4c84203?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwZHJlc3MlMjBjbG90aGluZyUyMHdoaXRlJTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3NzAyNjUzMTJ8MA&ixlib=rb-4.1.0&q=80&w=400'
        }
      ],
      explanation: `A sophisticated choice for special occasions. The elegant silhouette is perfect for evening events, complementing the ${contextData.month} atmosphere.`,
      tags: ['Elegant', 'Sophisticated', 'Timeless']
    }
  ];

  // Filter based on preferences
  return outfits.filter(outfit => {
    // If user wants to avoid dresses, filter them out
    if (preferenceData.constraints.includes('avoid-dresses')) {
      return !outfit.items.some(item => item.type === 'dress');
    }
    return true;
  }).slice(0, 3);
};

export function RecommendationScreen({
  contextData,
  preferenceData,
  onRegenerate,
  onAdjustPreferences,
  onStartOver
}: RecommendationScreenProps) {
  const [expandedOutfit, setExpandedOutfit] = useState<string | null>(null);
  const outfits = generateOutfits(contextData, preferenceData);

  const toggleExpand = (outfitId: string) => {
    setExpandedOutfit(expandedOutfit === outfitId ? null : outfitId);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">1</div>
            <span className="text-neutral-400">Context</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">2</div>
            <span className="text-neutral-400">Preferences</span>
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">3</div>
            <span>Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Your Outfit Recommendations</h2>
          <p className="text-neutral-600">
            {contextData.occasion} • {contextData.destination} • {contextData.month}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {preferenceData.styles.map((style) => (
              <Badge key={style} variant="secondary" className="capitalize">
                {style}
              </Badge>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button
            onClick={onRegenerate}
            variant="outline"
            className="rounded-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
          <Button
            onClick={onAdjustPreferences}
            variant="outline"
            className="rounded-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            Adjust Preferences
          </Button>
          <Button
            onClick={onStartOver}
            variant="outline"
            className="rounded-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        </div>

        {/* Outfit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outfits.map((outfit) => (
            <Card key={outfit.id} className="overflow-hidden bg-white hover:shadow-lg transition-shadow">
              <div className="p-4">
                <h3 className="font-medium text-lg mb-3">{outfit.name}</h3>
                
                {/* Outfit Items */}
                <div className="space-y-3 mb-4">
                  {outfit.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-neutral-500 capitalize">{item.type}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {outfit.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Explanation Toggle */}
                <button
                  onClick={() => toggleExpand(outfit.id)}
                  className="w-full text-left text-sm text-neutral-600 hover:text-neutral-900 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium">Why this works</span>
                  {expandedOutfit === outfit.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {expandedOutfit === outfit.id && (
                  <p className="text-sm text-neutral-600 mt-3 leading-relaxed">
                    {outfit.explanation}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>

        {outfits.length === 0 && (
          <Card className="p-8 text-center bg-white">
            <p className="text-neutral-600">No outfits match your current preferences. Try adjusting your constraints.</p>
            <Button onClick={onAdjustPreferences} className="mt-4 bg-black hover:bg-neutral-800 text-white rounded-full">
              Adjust Preferences
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
