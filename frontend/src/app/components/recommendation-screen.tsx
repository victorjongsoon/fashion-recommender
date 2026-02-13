import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { RefreshCw, Settings, Home, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
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
  type: 'top' | 'bottom' | 'outerwear';
  image: string;
  itemId?: string; // H&M article_id for fetching from image-service
};

type Outfit = {
  id: string;
  name: string;
  items: OutfitItem[];
  explanation: string;
  tags: string[];
};

// Generate outfit recommendations with H&M article_ids
// These will be fetched from the image-service via /images/{article_id} endpoint
const generateOutfits = (contextData: ContextData, preferenceData: PreferenceData): Outfit[] => {
  const isWinter = ['January', 'February', 'March', 'November', 'December'].includes(contextData.month);
  
  // Get image service URL from environment
  // Defaults to localhost for development if .env not set
  const imageServiceUrl = import.meta.env.VITE_IMAGE_SERVICE_URL || 'http://localhost:8001';
  
  const getImageUrl = (article_id: string) => {
    return `${imageServiceUrl}/images/${article_id}`;
  };
  
  // Hardcoded outfits with H&M article_ids
  // Format: 10-digit numeric ID (e.g., "0108775015" for article 0108775015.jpg)
  const outfits: Outfit[] = [
    {
      id: '1',
      name: 'Casual Comfort',
      items: [
        {
          id: 't1',
          name: 'Basic T-Shirt',
          type: 'top',
          image: getImageUrl('0108775015'),
          itemId: '0108775015'
        },
        {
          id: 'b1',
          name: 'Denim Jeans',
          type: 'bottom',
          image: getImageUrl('0720504001'),
          itemId: '0720504001'
        }
      ],
      explanation: `A comfortable everyday look perfect for ${contextData.destination}.`,
      tags: ['Casual', 'Comfortable']
    },
    {
      id: '2',
      name: 'Smart Casual',
      items: [
        {
          id: 't2',
          name: 'Shirt',
          type: 'top',
          image: getImageUrl('0211143022'),
          itemId: '0211143022'
        },
        {
          id: 'b2',
          name: 'Trousers',
          type: 'bottom',
          image: getImageUrl('0397068001'),
          itemId: '0397068001'
        }
      ],
      explanation: `Balanced and polished for ${contextData.occasion}.`,
      tags: ['Polished']
    }
  ];

  // Filter based on preferences
  return outfits.filter(outfit => {
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
  const [tryOnMode, setTryOnMode] = useState<'top' | 'bottom' | 'both' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [generationStep, setGenerationStep] = useState<string>('');
  const outfits = generateOutfits(contextData, preferenceData);

  const toggleExpand = (outfitId: string) => {
    setExpandedOutfit(expandedOutfit === outfitId ? null : outfitId);
  };

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => new Set([...prev, itemId]));
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
    setTryOnMode(null);
    setIsGenerating(false);
    setGenerationStep('');
  };

  const onUserPhotoChange = (f?: File) => {
    if (!f) return;
    setUserPhoto(f);
    const url = URL.createObjectURL(f);
    setUserPhotoPreview(url);
  };

  async function handleGenerateTryOn() {
    if (!userPhoto || !selectedOutfit || !tryOnMode) return;
    setIsGenerating(true);
    setResultUrl(null);

    try {
      let currentImage = userPhoto;
      let currentImageUrl = userPhotoPreview;

      // Get relevant items based on mode
      const topItem = selectedOutfit.items.find(item => item.type === 'top');
      const bottomItem = selectedOutfit.items.find(item => item.type === 'bottom');

      // Step 1: Try on top if needed
      if ((tryOnMode === 'top' || tryOnMode === 'both') && topItem) {
        setGenerationStep('Dressing top...');
        const topResult = await callVtonService(currentImage, topItem);
        if (topResult) {
          // Convert result URL to blob and then to File for next iteration
          const topBlob = await fetch(topResult).then(r => r.blob());
          currentImage = new File([topBlob], 'tryon-top.jpg', { type: 'image/jpeg' });
          currentImageUrl = topResult;
          setResultUrl(topResult);
        } else {
          throw new Error('Failed to dress top');
        }
      }

      // Step 2: Try on bottom if needed
      if ((tryOnMode === 'bottom' || tryOnMode === 'both') && bottomItem) {
        setGenerationStep(tryOnMode === 'both' ? 'Dressing bottom...' : 'Dressing bottom...');
        const bottomResult = await callVtonService(currentImage, bottomItem);
        if (bottomResult) {
          setResultUrl(bottomResult);
        } else {
          throw new Error('Failed to dress bottom');
        }
      }

      setGenerationStep('');
    } catch (e) {
      console.error('Try-on error:', e);
      setGenerationStep('');
      // Could show error toast here
    } finally {
      setIsGenerating(false);
    }
  }

  async function callVtonService(bodyImage: File, garmentItem: OutfitItem): Promise<string | null> {
    try {
      const vtonServiceUrl = import.meta.env.VITE_VTON_SERVICE_URL || 'http://localhost:8002';
      
      // Send garment URL to backend so the server can download it (avoids browser CORS)
      const form = new FormData();
      form.append('photo', bodyImage);
      form.append('garment_url', garmentItem.image);
      form.append('garment_des', `${garmentItem.name} ${garmentItem.type}`);

      const resp = await fetch(`${vtonServiceUrl}/tryon`, {
        method: 'POST',
        body: form
      });

      if (resp.ok) {
        const json = await resp.json();
        if (json?.image_url) {
          return json.image_url;
        }
      } else {
        const txt = await resp.text();
        console.error('VTON returned non-OK:', resp.status, txt);
      }
      return null;
    } catch (e) {
      console.error('VTON service error:', e);
      return null;
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
            {preferenceData.preferred_colors && preferenceData.preferred_colors.length > 0 && (
              <>
                {preferenceData.preferred_colors.map((color) => (
                  <Badge key={color} variant="secondary" className="capitalize bg-green-100 text-green-800 border-green-300">
                    {color}
                  </Badge>
                ))}
              </>
            )}
            {preferenceData.avoid_colors && preferenceData.avoid_colors.length > 0 && (
              <>
                {preferenceData.avoid_colors.map((color) => (
                  <Badge key={color} variant="secondary" className="capitalize bg-red-100 text-red-800 border-red-300">
                    No {color}
                  </Badge>
                ))}
              </>
            )}
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
                        {imageErrors.has(item.id) ? (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                            Image not found
                          </div>
                        ) : (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(item.id)}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-neutral-500 capitalize">{item.type}</p>
                        {item.itemId && <p className="text-xs text-neutral-400">ID: {item.itemId}</p>}
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
                {/* Try-On button */}
                <div className="mt-4">
                  <Button
                    onClick={() => openTryOn(outfit)}
                    variant="outline"
                    className="w-full rounded-full"
                  >
                    Try this outfit on
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
          tryOnMode={tryOnMode}
          onTryOnModeChange={setTryOnMode}
          generationStep={generationStep}
          imageErrors={imageErrors}
          handleImageError={handleImageError}
        />
      </div>
    </div>
  );
}

// Modal component for virtual try-on with mode selection
function TryOnModal({
  open,
  outfit,
  onClose,
  onPhotoChange,
  photoPreview,
  onGenerate,
  isGenerating,
  resultUrl,
  tryOnMode,
  onTryOnModeChange,
  generationStep,
  imageErrors,
  handleImageError
}: {
  open: boolean;
  outfit: Outfit | null;
  onClose: () => void;
  onPhotoChange: (f?: File) => void;
  photoPreview: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  resultUrl: string | null;
  tryOnMode: 'top' | 'bottom' | 'both' | null;
  onTryOnModeChange: (mode: 'top' | 'bottom' | 'both') => void;
  generationStep: string;
  imageErrors: Set<string>;
  handleImageError: (itemId: string) => void;
}) {
  if (!open || !outfit) return null;

  const hasTop = outfit.items.some(item => item.type === 'top');
  const hasBottom = outfit.items.some(item => item.type === 'bottom');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {isGenerating && (
          <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 p-4">
              <Loader2 className="w-10 h-10 animate-spin text-black" />
              <div className="text-sm font-medium text-neutral-800">{generationStep || 'Generating try-on...'}</div>
              <div className="text-xs text-neutral-600">This may take a while — do not close this window.</div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="sticky top-0 p-6 border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">{outfit.name} - Virtual Try-On</h3>
              <p className="text-sm text-neutral-500 mt-1">Try this outfit on your full-body photo</p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Upload Full Body Photo */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-3">Step 1: Upload Your Full-Body Photo</h4>
            <p className="text-sm text-neutral-600 mb-4">
              Please upload a clear, full-body, front-facing photo for best results. The photo should show your entire body from head to toe.
            </p>
            <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPhotoChange(e.target.files?.[0] ?? undefined)}
                className="mb-4 w-full"
                disabled={isGenerating}
              />

              {photoPreview && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Photo preview:</p>
                  <div className="w-full max-h-[60vh] rounded-lg overflow-auto bg-neutral-100 flex items-center justify-center">
                    <img src={photoPreview} alt="user preview" className="max-h-[60vh] w-auto object-contain" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Select Try-On Mode */}
          {photoPreview && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-3">Step 2: Select What to Try On</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {hasTop && (
                  <button
                    onClick={() => onTryOnModeChange('top')}
                    disabled={isGenerating}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      tryOnMode === 'top'
                        ? 'border-black bg-black/5'
                        : 'border-neutral-200 hover:border-neutral-300'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="font-medium">Try Top Only</div>
                    <div className="text-xs text-neutral-500 mt-1">Dress the top piece</div>
                  </button>
                )}

                {hasBottom && (
                  <button
                    onClick={() => onTryOnModeChange('bottom')}
                    disabled={isGenerating}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      tryOnMode === 'bottom'
                        ? 'border-black bg-black/5'
                        : 'border-neutral-200 hover:border-neutral-300'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="font-medium">Try Bottom Only</div>
                    <div className="text-xs text-neutral-500 mt-1">Dress the bottom piece</div>
                  </button>
                )}

                {hasTop && hasBottom && (
                  <button
                    onClick={() => onTryOnModeChange('both')}
                    disabled={isGenerating}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      tryOnMode === 'both'
                        ? 'border-black bg-black/5'
                        : 'border-neutral-200 hover:border-neutral-300'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="font-medium">Try Both</div>
                    <div className="text-xs text-neutral-500 mt-1">Dress top and bottom</div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Selected Outfit Items */}
          {photoPreview && tryOnMode && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-3">Outfit Items to Apply</h4>
              <div className="space-y-3">
                {outfit.items.map(item => {
                  const shouldInclude =
                    (tryOnMode === 'top' && item.type === 'top') ||
                    (tryOnMode === 'bottom' && item.type === 'bottom') ||
                    (tryOnMode === 'both' && (item.type === 'top' || item.type === 'bottom'));

                  if (!shouldInclude) return null;

                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-neutral-50 rounded-lg">
                      <div className="w-20 h-20 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                        {imageErrors.has(item.id) ? (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-xs text-neutral-500">
                            Not found
                          </div>
                        ) : (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(item.id)}
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-neutral-500 capitalize">{item.type}</div>
                        {item.itemId && <div className="text-xs text-neutral-400">ID: {item.itemId}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results Section */}
          {resultUrl && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-3">Try-On Result</h4>
              <div className="w-full rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                <img src={resultUrl} alt="tryon result" className="w-full h-auto object-contain" />
              </div>
              <p className="text-xs text-neutral-500 mt-2">This is an AI-generated visualization. Results may vary based on image quality and lighting.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            {photoPreview && tryOnMode && (
              <Button
                onClick={onGenerate}
                disabled={isGenerating || !tryOnMode}
                className="rounded-lg bg-black hover:bg-neutral-800 text-white flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {generationStep || 'Generating...'}
                  </>
                ) : (
                  <>Generate Try-On</>
                )}
              </Button>
            )}

            {resultUrl && (
              <Button
                onClick={() => {
                  onTryOnModeChange('top');
                }}
                disabled={isGenerating}
                variant="outline"
                className="rounded-lg"
              >
                Try Different Outfit
              </Button>
            )}

            <Button
              onClick={onClose}
              disabled={isGenerating}
              variant="outline"
              className="rounded-lg"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
