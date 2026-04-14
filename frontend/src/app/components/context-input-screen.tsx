import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ArrowRight, MapPin, Calendar, Briefcase, Palette, ChevronDown, ChevronUp, X, Users, Hash, DollarSign, MessageCircle, ClipboardList, Send, Loader2 } from 'lucide-react';
import type { FormData } from '../App';

const AGENT_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8004';
const WEATHER_SERVICE_URL = import.meta.env.VITE_WEATHER_SERVICE_URL || 'http://localhost:8005';

interface ContextInputScreenProps {
  initialData: FormData;
  onSubmit: (data: FormData) => void;
}

// ── Original form constants ───────────────────────────────────────────────────
const occasions = ['Casual', 'Formal', 'Sport', 'Party'];
const destinations = [
  'Tokyo', 'Seoul', 'Bangkok', 'Singapore', 'Bali',
  'Sydney', 'London', 'Paris', 'Rome', 'Barcelona',
  'Amsterdam', 'Dubai', 'Istanbul', 'New York', 'Los Angeles',
  'San Francisco', 'Miami', 'Toronto', 'Reykjavik', 'Cape Town'
];
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const categories = ['Ladieswear', 'Menswear'];
const outfitCounts = [1, 2, 3, 4, 5];
// Palette aligned with backend `app/colors.py` PALETTE. Each of these maps
// to multiple KG colour variants on the server side, so users pick a simple
// name and the query still matches every shade/tone variant in the catalogue.
const colorMap: Record<string, string> = {
  'Black':     '#000000',
  'White':     '#FFFFFF',
  'Grey':      '#808080',
  'Blue':      '#0066CC',
  'Red':       '#DC143C',
  'Pink':      '#FFB6C1',
  'Green':     '#228B22',
  'Yellow':    '#FFD700',
  'Orange':    '#FF8C00',
  'Purple':    '#9370DB',
  'Beige':     '#F5F5DC',
  'Brown':     '#8B4513',
  'Turquoise': '#40E0D0',
  'Gold':      '#DAA520',
  'Silver':    '#C0C0C0',
};
const colorOptions = Object.keys(colorMap);
const lightColors = ['White', 'Beige', 'Yellow', 'Silver'];

// ── Chat types ────────────────────────────────────────────────────────────────
type ChatMessage = { role: 'agent' | 'user'; text: string };

export function ContextInputScreen({ initialData, onSubmit }: ContextInputScreenProps) {
  // Tab
  const [activeTab, setActiveTab] = useState<'form' | 'chat'>('form');

  // ── Form state (original) ──────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>(initialData);
  const [showPreferredColors, setShowPreferredColors] = useState(initialData.preferred_colors.length > 0);
  const [showAvoidColors, setShowAvoidColors] = useState(initialData.avoid_colors.length > 0);

  const togglePreferredColor = (color: string) =>
    setFormData(prev => ({
      ...prev,
      preferred_colors: prev.preferred_colors.includes(color)
        ? prev.preferred_colors.filter(c => c !== color)
        : [...prev.preferred_colors, color]
    }));

  const toggleAvoidColor = (color: string) =>
    setFormData(prev => ({
      ...prev,
      avoid_colors: prev.avoid_colors.includes(color)
        ? prev.avoid_colors.filter(c => c !== color)
        : [...prev.avoid_colors, color]
    }));

  const isFormValid = formData.occasion && formData.destination && formData.month &&
    formData.category && formData.num_outfits >= 1;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    try {
      const resp = await fetch(
        `${WEATHER_SERVICE_URL}/weather?destination=${encodeURIComponent(formData.destination)}&month=${encodeURIComponent(formData.month)}`
      );
      if (resp.ok) {
        const weather = await resp.json();
        onSubmit({ ...formData, season: weather.season });
        return;
      }
    } catch (e) {
      console.error('Weather service error:', e);
    }
    onSubmit(formData);
  };

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatDone, setChatDone] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start session when chat tab opened
  useEffect(() => {
    if (activeTab !== 'chat' || sessionId || messages.length > 0) return;
    const start = async () => {
      setChatLoading(true);
      try {
        const resp = await fetch(`${AGENT_URL}/api/start`);
        const data = await resp.json();
        setSessionId(data.session_id);
        setMessages([{ role: 'agent', text: data.message }]);
      } catch {
        setMessages([{ role: 'agent', text: "Sorry, I can't connect right now. Please use the form instead." }]);
      } finally {
        setChatLoading(false);
      }
    };
    start();
  }, [activeTab, sessionId, messages.length]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !sessionId || chatDone) return;
    const userText = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatLoading(true);
    try {
      const resp = await fetch(`${AGENT_URL}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userText }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'agent', text: data.message }]);
      if (data.done && data.results) {
        setChatDone(true);
        const ex = data.results.extracted || {};
        const month = mapMonth(ex.month || 'June');
        const kgInputs = data.results.kg_inputs || [];
        const mapped: FormData = {
          occasion:         mapOccasion(ex.occasion || ''),
          destination:      mapDestination(ex.destination || 'Singapore'),
          month:            month,
          category:         mapCategory(ex.gender || ''),
          num_outfits:      parseInt(ex.num_outfits || '3') || 3,
          max_price:        parseInt(ex.max_price || '200') || 200,
          preferred_colors: parseColours(ex.colours_liked || ''),
          avoid_colors:     parseColours(ex.colours_disliked || ''),
          season:           ex.season || deriveSeason(month),
          kg_inputs:        kgInputs.length > 0 ? kgInputs : undefined,
        };
        setMessages(prev => [...prev, {
          role: 'agent',
          text: `Perfect! I've got everything I need 🎉\n\n📍 ${mapped.destination} · 📅 ${mapped.month}\n👔 ${mapped.occasion} · ${mapped.category}\n💰 Max $${mapped.max_price} · ${mapped.num_outfits} outfits${mapped.preferred_colors.length ? '\n✅ Colours: ' + mapped.preferred_colors.join(', ') : ''}${mapped.avoid_colors.length ? '\n❌ Avoiding: ' + mapped.avoid_colors.join(', ') : ''}\n\nLoading your recommendations...`
        }]);
        setTimeout(() => onSubmit(mapped), 2000);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">1</div>
            <span>Your Details</span>
            <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs">2</div>
            <span className="text-neutral-400">Results</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-2">Plan your outfit</h2>
          <p className="text-neutral-600">Tell us about your trip — use the form or chat with our advisor</p>
        </div>

        {/* ── Tab toggle ── */}
        <div className="flex gap-1 mb-8 bg-neutral-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'form'
                ? 'bg-white shadow text-black'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Fill Form
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-white shadow text-black'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Chat with Advisor
          </button>
        </div>

        {/* ── FORM TAB ── */}
        {activeTab === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-10">
            <div className="space-y-6">
              <h3 className="text-lg font-medium border-b border-neutral-200 pb-2">Trip Details</h3>

              {/* Occasion */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Occasion
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {occasions.map(o => (
                    <button key={o} type="button" onClick={() => setFormData({ ...formData, occasion: o })}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${formData.occasion === o ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Destination
                </Label>
                <select value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full h-12 px-3 rounded-lg border-2 border-neutral-200 bg-white text-sm focus:outline-none focus:border-black transition-colors">
                  <option value="">Select a destination</option>
                  {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Month */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Month
                </Label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {months.map(m => (
                    <button key={m} type="button" onClick={() => setFormData({ ...formData, month: m })}
                      className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${formData.month === m ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-medium border-b border-neutral-200 pb-2">Style Preferences</h3>

              {/* Category */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" /> Category
                </Label>
                <div className="flex gap-2">
                  {categories.map(c => (
                    <button key={c} type="button" onClick={() => setFormData({ ...formData, category: c })}
                      className={`px-6 py-3 rounded-lg border-2 transition-all ${formData.category === c ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Outfits */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Number of Outfits
                </Label>
                <div className="flex gap-2">
                  {outfitCounts.map(n => (
                    <button key={n} type="button" onClick={() => setFormData({ ...formData, num_outfits: n })}
                      className={`w-12 h-12 rounded-lg border-2 transition-all text-sm font-medium ${formData.num_outfits === n ? 'border-black bg-black text-white' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Budget per Outfit
                </Label>
                <div className="space-y-2">
                  <input type="range" min={20} max={500} step={10} value={formData.max_price}
                    onChange={e => setFormData({ ...formData, max_price: Number(e.target.value) })}
                    className="w-full accent-black" />
                  <div className="flex justify-between text-sm text-neutral-500">
                    <span>$20</span>
                    <span className="font-medium text-black">${formData.max_price}</span>
                    <span>$500</span>
                  </div>
                </div>
              </div>

              {/* Preferred Colors */}
              <div className="space-y-3">
                <button type="button" onClick={() => setShowPreferredColors(!showPreferredColors)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    <span className="text-sm font-medium">Preferred Colors</span>
                    <span className="text-neutral-400 text-xs">(optional)</span>
                    {formData.preferred_colors.length > 0 && <span className="text-xs text-neutral-500">({formData.preferred_colors.length} selected)</span>}
                  </div>
                  {showPreferredColors ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                </button>
                {showPreferredColors && (
                  <div className="space-y-3 pt-2">
                    {formData.preferred_colors.length > 0 && (
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setFormData({ ...formData, preferred_colors: [] })}
                          className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1">
                          <X className="w-3 h-3" /> Clear all
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                      {colorOptions.map(color => (
                        <button key={color} type="button" onClick={() => togglePreferredColor(color)}
                          title={color}
                          className={`w-10 h-10 rounded-full transition-all ${formData.preferred_colors.includes(color) ? 'ring-4 ring-green-500 ring-offset-2 scale-110' : 'ring-2 ring-neutral-300 hover:ring-neutral-400 hover:scale-105'}`}
                          style={{ backgroundColor: colorMap[color], border: lightColors.includes(color) ? '1px solid #e5e5e5' : 'none' }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Colors to Avoid */}
              <div className="space-y-3">
                <button type="button" onClick={() => setShowAvoidColors(!showAvoidColors)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    <span className="text-sm font-medium">Colors to Avoid</span>
                    <span className="text-neutral-400 text-xs">(optional)</span>
                    {formData.avoid_colors.length > 0 && <span className="text-xs text-neutral-500">({formData.avoid_colors.length} selected)</span>}
                  </div>
                  {showAvoidColors ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                </button>
                {showAvoidColors && (
                  <div className="space-y-3 pt-2">
                    {formData.avoid_colors.length > 0 && (
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setFormData({ ...formData, avoid_colors: [] })}
                          className="text-xs text-neutral-500 hover:text-neutral-700 flex items-center gap-1">
                          <X className="w-3 h-3" /> Clear all
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
                      {colorOptions.map(color => (
                        <button key={color} type="button" onClick={() => toggleAvoidColor(color)}
                          title={color}
                          className={`w-10 h-10 rounded-full transition-all relative ${formData.avoid_colors.includes(color) ? 'ring-4 ring-red-500 ring-offset-2 scale-110' : 'ring-2 ring-neutral-300 hover:ring-neutral-400 hover:scale-105'}`}
                          style={{ backgroundColor: colorMap[color], border: lightColors.includes(color) ? '1px solid #e5e5e5' : 'none' }}>
                          {formData.avoid_colors.includes(color) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <X className="w-5 h-5 text-white drop-shadow-lg" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" disabled={!isFormValid}
              className="w-full bg-black hover:bg-neutral-800 text-white h-12 rounded-full">
              Get Recommendations
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col bg-white border border-neutral-200 rounded-2xl overflow-hidden" style={{ height: '520px' }}>
            {/* Chat header */}
            <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
              <p className="text-sm text-neutral-600">
                Chat with your style advisor — I'll ask you a few questions and find the perfect outfits!
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatLoading && messages.length === 0 && (
                <div className="flex items-center gap-2 text-neutral-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting to style advisor...
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'agent' && (
                    <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <span className="text-white text-xs">✦</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-br-sm'
                      : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {chatLoading && messages.length > 0 && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">✦</span>
                  </div>
                  <div className="bg-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {chatDone && (
                <div className="text-center text-sm text-neutral-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Loading your recommendations...
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-neutral-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                  placeholder={chatDone ? 'All done!' : 'Type your answer...'}
                  disabled={chatLoading || chatDone || !sessionId}
                  className="flex-1 px-4 py-2.5 rounded-full border border-neutral-200 text-sm focus:outline-none focus:border-black transition-colors disabled:opacity-40"
                />
                <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim() || chatDone || !sessionId}
                  className="rounded-full bg-black hover:bg-neutral-800 text-white w-11 h-11 p-0 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function mapOccasion(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('sport') || r.includes('gym') || r.includes('hik')) return 'Sport';
  if (r.includes('formal') || r.includes('business') || r.includes('dinner') || r.includes('feast') || r.includes('banquet')) return 'Formal';
  if (r.includes('party')) return 'Party';
  return 'Casual';
}
function mapDestination(raw: string): string {
  // Take the first destination if multiple
  const first = raw.split(',')[0].trim();
  const destinations = ['Tokyo','Seoul','Bangkok','Singapore','Bali','Sydney','London','Paris','Rome','Barcelona','Amsterdam','Dubai','Istanbul','New York','Los Angeles','San Francisco','Miami','Toronto','Reykjavik','Cape Town'];
  // Try to match to a known destination
  const match = destinations.find(d => first.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(first.toLowerCase()));
  return match || 'Singapore';
}
function mapMonth(raw: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const abbrs: Record<string,string> = { jan:'January',feb:'February',mar:'March',apr:'April',may:'May',jun:'June',jul:'July',aug:'August',sep:'September',oct:'October',nov:'November',dec:'December' };
  const first = raw.split(',')[0].trim().toLowerCase();
  return abbrs[first.slice(0,3)] || months.find(m => m.toLowerCase().startsWith(first.slice(0,3))) || 'June';
}
function mapCategory(gender: string): string {
  return gender.toLowerCase().includes('female') || gender.toLowerCase().includes('woman')
    ? 'Ladieswear' : 'Menswear';
}
function mapBudget(budget: string): number {
  if (!budget || budget === 'null') return 100;
  const nums = budget.match(/\d+/g);
  if (nums && nums.length >= 2) return Math.round((parseInt(nums[0]) + parseInt(nums[1])) / 2);
  if (nums) return parseInt(nums[0]);
  return 100;
}

function parseColours(raw: string): string[] {
  if (!raw || raw === 'none' || raw === 'null') return [];
  // Must match backend PALETTE in services/agent-service/app/colors.py.
  const known = ['Black','White','Grey','Blue','Red','Pink','Green','Yellow',
    'Orange','Purple','Beige','Brown','Turquoise','Gold','Silver'];
  return known.filter(c => raw.toLowerCase().includes(c.toLowerCase()));
}

// Derive season from month (since KG only has Spring/Summer, map others)
function deriveSeason(month: string): string {
  const m = month.toLowerCase();
  if (['march','april','may'].some(x => m.includes(x))) return 'Spring';
  if (['june','july','august'].some(x => m.includes(x))) return 'Summer';
  if (['september','october','november'].some(x => m.includes(x))) return 'Summer'; // fallback to Summer (KG has no Autumn)
  return 'Spring'; // winter → Spring fallback (KG has no Winter)
}
