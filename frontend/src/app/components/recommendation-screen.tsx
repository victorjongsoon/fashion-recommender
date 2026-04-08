import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { RefreshCw, Settings, Home, Loader2, AlertCircle } from 'lucide-react';
import type { FormData, KgInput } from '../App';

const RECOMMENDER_URL = import.meta.env.VITE_RECOMMENDER_SERVICE_URL || 'http://localhost:8003';
const IMAGE_SERVICE_URL = import.meta.env.VITE_IMAGE_SERVICE_URL || 'http://localhost:8001';

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

function mapApiOutfits(apiOutfits: ApiOutfit[], groupIdx: number): Outfit[] {
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
      },
      {
        id: `b${groupIdx}-${i}`,
        name: `${o.bottom_color} ${o.bottom_type}`,
        type: 'bottom' as const,
        image: getImageUrl(o.bottom_article_id),
        itemId: o.bottom_article_id,
        price: o.bottom_price,
        pattern: o.bottom_pattern,
      },
    ],
  }));
}

// Build the list of requests to make
function buildRequests(formData: FormData): KgInput[] {
  // If chatbot provided kg_inputs, use them directly
  if (formData.kg_inputs && formData.kg_inputs.length > 0) {
    return formData.kg_inputs;
  }
  // Otherwise fall back to single request from form
  return [{
    occasion:         formData.occasion,
    category:         formData.category,
    num_outfits:      formData.num_outfits,
    max_price:        formData.max_price,
    preferred_colors: formData.preferred_colors,
    avoid_colors:     formData.avoid_colors,
    season:           formData.season,
    gender:           formData.category === 'Menswear' ? 'male' : 'female',
    destination:      formData.destination,
    month:            formData.month,
    avg_temp_c:       0,
    rain_prob:        0,
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

  const fetchAll = useCallback(async () => {
    const requests = buildRequests(formData);

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
        const outfits = mapApiOutfits(data.outfits || [], idx);
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
            {groups.length} trip{groups.length > 1 ? 's' : ''} ·{' '}
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
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-medium">{group.label}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-neutral-500 mt-1">
                    {group.season && <span className="capitalize">🌤 {group.season}</span>}
                    {group.avg_temp_c !== undefined && group.avg_temp_c > 0 && (
                      <span>🌡 {group.avg_temp_c}°C</span>
                    )}
                    {group.rain_prob !== undefined && group.rain_prob > 0 && (
                      <span>☂️ {Math.round(group.rain_prob * 100)}% rain</span>
                    )}
                  </div>
                </div>
                <div className="h-px flex-1 bg-neutral-200" />
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
                  {group.outfits.map(outfit => (
                    <Card key={outfit.id} className="p-4 rounded-2xl border border-neutral-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">{outfit.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {outfit.fitnessScore.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {outfit.items.map(item => (
                          <div key={item.id} className="space-y-1"
                            onClick={() => setDetailItem(item)}>
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
                            <p className="text-xs font-medium capitalize truncate">{item.name}</p>
                            {item.price && (
                              <p className="text-xs text-neutral-400">${item.price.toFixed(2)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
            {detailItem.pattern && (
              <p className="text-neutral-500 text-sm capitalize">{detailItem.pattern}</p>
            )}
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
