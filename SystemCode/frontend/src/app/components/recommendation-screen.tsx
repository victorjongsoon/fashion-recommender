import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { RefreshCw, Settings, Home, Loader2, AlertCircle } from 'lucide-react';
import type { FormData, KgInput } from '../App';

const RECOMMENDER_URL = import.meta.env.VITE_RECOMMENDER_SERVICE_URL || 'http://localhost:8003';
const IMAGE_SERVICE_URL = import.meta.env.VITE_IMAGE_SERVICE_URL || 'http://localhost:8001';
const WEATHER_SERVICE_URL = import.meta.env.VITE_WEATHER_SERVICE_URL || 'http://localhost:8005';

interface RecommendationScreenProps {
  formData: FormData;
  onRegenerate: () => void;
  onAdjustPreferences: () => void;
  onStartOver: () => void;
}

type ApiOutfit = {
  top_article_id: string;
  bottom_article_id: string;
  fitness_score: number;
  top_color: string;
  top_pattern: string;
  top_type: string;
  top_price: number;
  bottom_color: string;
  bottom_pattern: string;
  bottom_type: string;
  bottom_price: number;
  top_stock_status: string;
  top_occasion: string;
  bottom_stock_status: string;
  bottom_occasion: string;
};

type OutfitItem = {
  id: string;
  name: string;
  type: 'top' | 'bottom';
  image: string;
  itemId?: string;
  price?: number;
  pattern?: string;
  stockStatus?: string;
  occasion?: string;
  season?: string;
  color?: string;
};

type Outfit = {
  id: string;
  name: string;
  items: OutfitItem[];
  fitnessScore: number;
};

// One group = one unique combination of destination+month+occasion+budget+gender
type TripGroup = {
  label: string;        // e.g. "Singapore · December · Formal · Menswear · $200"
  destination: string;
  month: string;
  occasion: string;
  category: string;
  max_price: number;
  season?: string;
  avg_temp_c?: number;
  rain_prob?: number;
  outfits: Outfit[];
  loading: boolean;
  error: string | null;
};

function mapApiOutfits(apiOutfits: ApiOutfit[], groupIdx: number, season?: string): Outfit[] {
  const getImageUrl = (articleId: string) =>
    `${IMAGE_SERVICE_URL}/images/${articleId}`;
  return apiOutfits.map((o, i) => ({
    id: `${groupIdx}-${i}`,
    name: `Outfit ${i + 1}`,
    fitnessScore: o.fitness_score,
    items: [
      {
        id: `t${groupIdx}-${i}`,
        name: `${o.top_color} ${o.top_type}`,
        type: 'top' as const,
        image: getImageUrl(o.top_article_id),
        itemId: o.top_article_id,
        price: o.top_price,
        pattern: o.top_pattern,
        stockStatus: o.top_stock_status,
        occasion: o.top_occasion,
        season: season,
        color: o.top_color,
      },
      {
        id: `b${groupIdx}-${i}`,
        name: `${o.bottom_color} ${o.bottom_type}`,
        type: 'bottom' as const,
        image: getImageUrl(o.bottom_article_id),
        itemId: o.bottom_article_id,
        price: o.bottom_price,
        pattern: o.bottom_pattern,
        stockStatus: o.bottom_stock_status,
        occasion: o.bottom_occasion,
        season: season,
        color: o.bottom_color,
      },
    ],
  }));
}

async function fetchWeather(destination: string, month: string) {
  try {
    const resp = await fetch(
      `${WEATHER_SERVICE_URL}/weather?destination=${encodeURIComponent(destination)}&month=${encodeURIComponent(month)}`
    );
    if (resp.ok) return await resp.json();
  } catch (e) {
    console.error('Weather service error:', e);
  }
  return { avg_temp_c: 20, season: 'summer', rain_prob: 0.3, source: 'fallback' };
}

// Build the list of requests to make
async function buildRequests(formData: FormData): Promise<KgInput[]> {
  // If chatbot provided kg_inputs, use them directly
  if (formData.kg_inputs && formData.kg_inputs.length > 0) {
    return formData.kg_inputs;
  }
  // Otherwise fetch weather and build single request from form
  const weather = await fetchWeather(formData.destination, formData.month);
  return [{
    occasion:         formData.occasion,
    category:         formData.category,
    num_outfits:      formData.num_outfits,
    max_price:        formData.max_price,
    preferred_colors: formData.preferred_colors,
    avoid_colors:     formData.avoid_colors,
    season:           weather.season,
    gender:           formData.category === 'Menswear' ? 'male' : 'female',
    destination:      formData.destination,
    month:            formData.month,
    avg_temp_c:       weather.avg_temp_c,
    rain_prob:        weather.rain_prob,
  }];
}

export function RecommendationScreen({
  formData,
  onRegenerate,
  onAdjustPreferences,
  onStartOver,
}: RecommendationScreenProps) {
  const [groups, setGroups] = useState<TripGroup[]>([]);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<OutfitItem | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState<string | null>(null);
  const [tryOnMode, setTryOnMode] = useState<'top' | 'bottom' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState<string>('');

  const fetchAll = useCallback(async () => {
    const requests = await buildRequests(formData);

    // Deduplicate by season (not month) — same season = same KG results
    const seen = new Set<string>();
    const unique = requests.filter(r => {
      const key = `${r.destination}|${r.season || 'any'}|${r.occasion}|${r.max_price}|${r.category}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    // Initialise groups with loading state
    const initial: TripGroup[] = unique.map(r => ({
      label:       `${cap(r.destination)} · ${cap(r.season || r.month)} · ${cap(r.occasion)} · ${r.category} · $${r.max_price}`,
      destination: r.destination,
      month:       r.month,
      occasion:    r.occasion,
      category:    r.category,
      max_price:   r.max_price,
      season:      r.season,
      avg_temp_c:  r.avg_temp_c,
      rain_prob:   r.rain_prob,
      outfits:     [],
      loading:     true,
      error:       null,
    }));
    setGroups(initial);

    // Fetch each group in parallel
    await Promise.all(unique.map(async (r, idx) => {
      try {
        const resp = await fetch(`${RECOMMENDER_URL}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            occasion:         r.occasion,
            category:         r.category,
            num_outfits:      r.num_outfits,
            max_price:        r.max_price,
            preferred_colors: r.preferred_colors,
            avoid_colors:     r.avoid_colors,
            season:           r.season,
          }),
        });
        if (!resp.ok) throw new Error(`Service returned ${resp.status}`);
        const data = await resp.json();
        const outfits = mapApiOutfits(data.outfits || [], idx, r.season);
        setGroups(prev => prev.map((g, i) =>
          i === idx ? { ...g, outfits, loading: false } : g
        ));
      } catch (e) {
        setGroups(prev => prev.map((g, i) =>
          i === idx ? { ...g, loading: false, error: e instanceof Error ? e.message : 'Failed' } : g
        ));
      }
    }));
  }, [formData]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleImageError = (itemId: string) =>
    setImageErrors(prev => new Set([...prev, itemId]));

  const openTryOn = (outfit: Outfit) => {
    setSelectedOutfit(outfit);
    setTryOnOpen(true);
    setUserPhoto(null);
    setUserPhotoPreview(null);
    setResultUrl(null);
    setIsGenerating(false);
    setTryOnMode(null);
    setGenerationStep('');
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
    setUserPhotoPreview(URL.createObjectURL(f));
  };

  async function callVtonService(bodyImage: File, garmentItem: OutfitItem): Promise<string | null> {
    try {
      const vtonServiceUrl = import.meta.env.VITE_VTON_SERVICE_URL || 'http://localhost:8002';
      const form = new window.FormData();
      form.append('photo', bodyImage);
      form.append('garment_url', garmentItem.image);
      form.append('garment_des', `${garmentItem.name} ${garmentItem.type}`);
      const resp = await fetch(`${vtonServiceUrl}/tryon`, { method: 'POST', body: form });
      if (resp.ok) {
        const json = await resp.json();
        if (json?.image_url) return json.image_url;
      }
      return null;
    } catch (e) {
      console.error('VTON service error:', e);
      return null;
    }
  }

  async function handleGenerateTryOn() {
    if (!userPhoto || !selectedOutfit || !tryOnMode) return;
    setIsGenerating(true);
    setResultUrl(null);
    try {
      let currentImage = userPhoto;
      const topItem = selectedOutfit.items.find(item => item.type === 'top');
      const bottomItem = selectedOutfit.items.find(item => item.type === 'bottom');

      if (tryOnMode === 'top' && topItem) {
        setGenerationStep('Dressing top...');
        const topResult = await callVtonService(currentImage, topItem);
        if (topResult) {
          const topBlob = await fetch(topResult).then(r => r.blob());
          currentImage = new File([topBlob], 'tryon-top.jpg', { type: 'image/jpeg' });
          setResultUrl(topResult);
        } else {
          throw new Error('Failed to dress top');
        }
      }

      if (tryOnMode === 'bottom' && bottomItem) {
        setGenerationStep('Dressing bottom...');
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
    } finally {
      setIsGenerating(false);
    }
  }

  const totalLoading = groups.some(g => g.loading);
  const totalOutfits = groups.reduce((sum, g) => sum + g.outfits.length, 0);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">1</div>
            <span className="text-neutral-400">Your Details</span>
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">2</div>
            <span>Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">
            Your Outfit Recommendations
          </h2>
          <p className="text-neutral-500 text-sm">
            {totalLoading ? 'Loading...' : `${totalOutfits} outfit${totalOutfits !== 1 ? 's' : ''} found`}
          </p>
          {/* Colour badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.preferred_colors.map(c => (
              <Badge key={c} variant="secondary" className="bg-green-100 text-green-800 border-green-300 capitalize">{c}</Badge>
            ))}
            {formData.avoid_colors.map(c => (
              <Badge key={c} variant="secondary" className="bg-red-100 text-red-800 border-red-300 capitalize">No {c}</Badge>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button onClick={() => fetchAll()} variant="outline" className="rounded-full" disabled={totalLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${totalLoading ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
          <Button onClick={onAdjustPreferences} variant="outline" className="rounded-full">
            <Settings className="w-4 h-4 mr-2" />
            Adjust Preferences
          </Button>
          <Button onClick={onStartOver} variant="outline" className="rounded-full">
            <Home className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        </div>

        {/* Trip groups */}
        <div className="space-y-10">
          {groups.map((group, gIdx) => (
            <div key={gIdx}>
              {/* Group header */}
              <div className="mb-4">
                <h3 className="text-xl font-medium">{group.destination}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(group.season || group.month) && (
                    <Badge variant="secondary" className="capitalize">
                      {group.season || group.month}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="capitalize">{group.occasion}</Badge>
                  <Badge variant="secondary" className="capitalize">{group.category}</Badge>
                  <Badge variant="secondary">Budget ${group.max_price}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-neutral-500 mt-3">
                  {group.avg_temp_c !== undefined && (
                    <span>🌡 {group.avg_temp_c}°C</span>
                  )}
                  {group.rain_prob !== undefined && (
                    <span>☂️ {Math.round(group.rain_prob * 100)}% rain</span>
                  )}
                </div>
              </div>

              {/* Loading */}
              {group.loading && (
                <div className="flex items-center gap-2 text-neutral-400 py-8">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Finding outfits for {group.label}...</span>
                </div>
              )}

              {/* Error */}
              {!group.loading && group.error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{group.error}</p>
                </div>
              )}

              {/* No results */}
              {!group.loading && !group.error && group.outfits.length === 0 && (
                <div className="text-center py-8 text-neutral-400 text-sm bg-white rounded-2xl border border-neutral-100">
                  No outfits found for this trip. Try adjusting budget or colour preferences.
                </div>
              )}
              {/* Outfit cards */}
              {!group.loading && group.outfits.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                  {group.outfits.map(outfit => {
                    const totalPrice = outfit.items.reduce(
                      (sum, item) => sum + (item.price || 0),
                      0
                    );

                    return (
                      <Card key={outfit.id} className="p-4 rounded-2xl border border-neutral-200">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm">{outfit.name}</h4>
                          <div className="text-sm font-medium text-neutral-700">
                            Total: ${totalPrice.toFixed(2)}
                          </div>
                        </div>

                        {/* Items */}
                        <div className="grid grid-cols-2 gap-2">
                          {outfit.items.map(item => (
                            <div
                              key={item.id}
                              className="space-y-1"
                              onClick={() => setDetailItem(item)}
                            >
                              <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                                {!imageErrors.has(item.id) ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={() => handleImageError(item.id)}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs text-center p-2">
                                    {item.name}
                                  </div>
                                )}
                              </div>

                              <p className="text-xs font-medium capitalize truncate">
                                {item.name}
                              </p>

                              {item.price && (
                                <p className="text-xs text-neutral-400">
                                  ${item.price.toFixed(2)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <Button
                          onClick={() => openTryOn(outfit)}
                          variant="outline"
                          className="w-full rounded-full mt-3 text-xs"
                        >
                          Try this outfit on
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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

      {/* Item Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailItem(null)}>
          <Card className="w-full max-w-sm bg-white rounded-2xl p-6"
            onClick={e => e.stopPropagation()}>
            <img src={detailItem.image} alt={detailItem.name}
              className="w-full aspect-square object-cover rounded-xl mb-4" />
            <h3 className="font-medium capitalize">{detailItem.name}</h3>
            {detailItem.price && (
              <p className="text-neutral-500 text-sm">${detailItem.price.toFixed(2)}</p>
            )}

            <div className="mt-2 space-y-1 text-sm text-neutral-600">
              {/* Type */}
              <p className="capitalize">
                <span className="text-neutral-400">Item ID:</span> {detailItem.itemId}
              </p>

              {/* Type */}
              <p className="capitalize">
                <span className="text-neutral-400">Type:</span> {detailItem.type}
              </p>

              {/* Color */}
              {detailItem.color && (
                <p className="capitalize">
                  <span className="text-neutral-400">Color:</span> {detailItem.color}
                </p>
              )}

              {/* Pattern */}
              {detailItem.pattern && (
                <p className="capitalize">
                  <span className="text-neutral-400">Pattern:</span> {detailItem.pattern}
                </p>
              )}

              {/* Occasion */}
              {detailItem.occasion && (
                <p className="capitalize">
                  <span className="text-neutral-400">Occasion:</span> {detailItem.occasion}
                </p>
              )}

              {/* Season */}
              {detailItem.season && (
                <p className="capitalize">
                  <span className="text-neutral-400">Season:</span> {detailItem.season}
                </p>
              )}

              {/* Stock */}
              {detailItem.stockStatus && (
                <p className="capitalize">
                  <span className="text-neutral-400">Availability:</span> {detailItem.stockStatus}
                </p>
              )}
            </div>

            <Button onClick={() => setDetailItem(null)}
              className="mt-4 w-full rounded-full" variant="outline">
              Close
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

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
  handleImageError,
}: {
  open: boolean;
  outfit: Outfit | null;
  onClose: () => void;
  onPhotoChange: (f?: File) => void;
  photoPreview: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  resultUrl: string | null;
  tryOnMode: 'top' | 'bottom' | null;
  onTryOnModeChange: (mode: 'top' | 'bottom') => void;
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

        <div className="sticky top-0 p-6 border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold">{outfit.name} - Virtual Try-On</h3>
              <p className="text-sm text-neutral-500 mt-1">Try this outfit on your full-body photo</p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-3">Step 1: Upload Your Full-Body Photo</h4>
            <p className="text-sm text-neutral-600 mb-4">
              Please upload a clear, full-body, front-facing photo for best results.
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

          {photoPreview && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-3">Step 2: Select What to Try On</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {hasTop && (
                  <button
                    onClick={() => onTryOnModeChange('top')}
                    disabled={isGenerating}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      tryOnMode === 'top' ? 'border-black bg-black/5' : 'border-neutral-200 hover:border-neutral-300'
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
                      tryOnMode === 'bottom' ? 'border-black bg-black/5' : 'border-neutral-200 hover:border-neutral-300'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="font-medium">Try Bottom Only</div>
                    <div className="text-xs text-neutral-500 mt-1">Dress the bottom piece</div>
                  </button>
                )}
              </div>
            </div>
          )}

          {photoPreview && tryOnMode && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-3">Outfit Items to Apply</h4>
              <div className="space-y-3">
                {outfit.items.map(item => {
                  const shouldInclude =
                    (tryOnMode === 'top' && item.type === 'top') ||
                    (tryOnMode === 'bottom' && item.type === 'bottom');
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

          {resultUrl && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-3">Try-On Result</h4>
              <div className="w-full rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                <img src={resultUrl} alt="tryon result" className="w-full h-auto object-contain" />
              </div>
              <p className="text-xs text-neutral-500 mt-2">This is an AI-generated visualization. Results may vary.</p>
            </div>
          )}

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
            <Button onClick={onClose} disabled={isGenerating} variant="outline" className="rounded-lg">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
