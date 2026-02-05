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
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const outfits = generateOutfits(contextData, preferenceData);

  const toggleExpand = (outfitId: string) => {
    setExpandedOutfit(expandedOutfit === outfitId ? null : outfitId);
  };

  const openTryOn = (outfit: Outfit) => {
    setSelectedOutfit(outfit);
    setTryOnOpen(true);
    setUserPhoto(null);
    setUserPhotoPreview(null);
    setResultUrl(null);
    setIsGenerating(false);
  };

  const closeTryOn = () => {
    setTryOnOpen(false);
    setSelectedOutfit(null);
    setUserPhoto(null);
    setUserPhotoPreview(null);
    setResultUrl(null);
    setIsGenerating(false);
  };

  const onUserPhotoChange = (f?: File) => {
    if (!f) return;
    setUserPhoto(f);
    const url = URL.createObjectURL(f);
    setUserPhotoPreview(url);
  };

  async function handleGenerateTryOn() {
    if (!userPhoto || !selectedOutfit) return;
    setIsGenerating(true);
    setResultUrl(null);

    // Try to call backend /tryon endpoint; fallback to simulated image
    try {
      const form = new FormData();
      form.append('photo', userPhoto);
      form.append('outfitId', selectedOutfit.id);
      // Also send item ids
      form.append('items', JSON.stringify(selectedOutfit.items.map(i => i.id)));

      const resp = await fetch('/tryon', {
        method: 'POST',
        body: form
      });

      if (resp.ok) {
        const json = await resp.json();
        // Expect { image_url: string }
        if (json?.image_url) {
          setResultUrl(json.image_url);
        } else {
          // fallback
          setResultUrl('/placeholder-tryon.jpg');
        }
      } else {
        // fallback simulate
        await new Promise((r) => setTimeout(r, 1500));
        setResultUrl('/placeholder-tryon.jpg');
      }
    } catch (e) {
      // network or other error -> simulate
      await new Promise((r) => setTimeout(r, 1500));
      setResultUrl('/placeholder-tryon.jpg');
    } finally {
      setIsGenerating(false);
    }
  }

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
                {/* Try-On button (experimental) */}
                <div className="mt-4">
                  <Button
                    onClick={() => openTryOn(outfit)}
                    variant="outline"
                    className="w-full rounded-full"
                  >
                    Try this outfit on (Experimental)
                  </Button>
                </div>
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
        {/* Try-On Modal */}
        <TryOnModal
          open={tryOnOpen}
          outfit={selectedOutfit}
          onClose={closeTryOn}
          onPhotoChange={onUserPhotoChange}
          photoPreview={userPhotoPreview}
          onGenerate={handleGenerateTryOn}
          isGenerating={isGenerating}
          resultUrl={resultUrl}
        />
      </div>
    </div>
  );
}

// Modal component (simple, self-contained)
function TryOnModal({
  open,
  outfit,
  onClose,
  onPhotoChange,
  photoPreview,
  onGenerate,
  isGenerating,
  resultUrl
}: {
  open: boolean;
  outfit: Outfit | null;
  onClose: () => void;
  onPhotoChange: (f?: File) => void;
  photoPreview: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  resultUrl: string | null;
}) {
  if (!open || !outfit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium">Virtual Try-On (Experimental)</h3>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Upload your photo</label>
            <p className="text-xs text-neutral-500 mb-2">Upload a clear, full-body photo (front-facing) for best results.</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPhotoChange(e.target.files?.[0] ?? undefined)}
              className="mb-3"
            />

            {photoPreview && (
              <div className="w-full h-64 rounded-md overflow-hidden bg-neutral-100 flex items-center justify-center mb-3">
                <img src={photoPreview} alt="user preview" className="max-h-full object-contain" />
              </div>
            )}

            <div className="flex gap-2">
              <button
                className={`rounded-md px-4 py-2 text-sm ${isGenerating ? 'bg-neutral-200 text-neutral-500' : 'bg-black text-white'}`}
                onClick={onGenerate}
                disabled={!photoPreview || isGenerating}
              >
                {isGenerating ? 'Generating…' : 'Generate Try-On'}
              </button>
              <button className="rounded-md px-4 py-2 text-sm bg-neutral-50" onClick={onClose}>Close</button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Selected outfit</label>
            <div className="space-y-2">
              {outfit.items.map(it => (
                <div key={it.id} className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-md overflow-hidden bg-neutral-100">
                    <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-neutral-500 capitalize">{it.type}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium mb-2 block">Result</label>
              <div className="w-full h-64 rounded-md overflow-hidden bg-neutral-100 flex items-center justify-center">
                {resultUrl ? (
                  <img src={resultUrl} alt="tryon result" className="max-h-full object-contain" />
                ) : (
                  <div className="text-sm text-neutral-500">No result yet. Generate to see try-on.</div>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-2">This is an AI-generated visualization. Results may vary.</p>

              <div className="flex gap-2 mt-3">
                <button className="rounded-md px-3 py-2 text-sm bg-neutral-50" onClick={onClose}>Try another outfit</button>
                <button className="rounded-md px-3 py-2 text-sm bg-neutral-50" onClick={onClose}>Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
