import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { ArrowRight, MapPin, Calendar, Briefcase, ChevronDown } from 'lucide-react';
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

// Popular destinations (cities and countries)
const popularDestinations = [
  // Asian cities
  'Tokyo, Japan',
  'Singapore',
  'Hong Kong',
  'Seoul, South Korea',
  'Bangkok, Thailand',
  'Kuala Lumpur, Malaysia',
  'Shanghai, China',
  'Beijing, China',
  'Dubai, UAE',
  'Abu Dhabi, UAE',
  'Taipei, Taiwan',
  'Manila, Philippines',
  'Jakarta, Indonesia',
  'Bali, Indonesia',
  'Hanoi, Vietnam',
  'Ho Chi Minh City, Vietnam',
  'Phuket, Thailand',
  'Chiang Mai, Thailand',
  'Mumbai, India',
  'Delhi, India',
  'Bangalore, India',
  'Osaka, Japan',
  'Kyoto, Japan',
  'Busan, South Korea',
  'Macau',
  'Doha, Qatar',
  'Riyadh, Saudi Arabia',
  'Tel Aviv, Israel',
  'Istanbul, Turkey',
  'Colombo, Sri Lanka',
  'Kathmandu, Nepal',
  'Phnom Penh, Cambodia',
  'Yangon, Myanmar',
  
  // European cities
  'Paris, France',
  'London, United Kingdom',
  'Barcelona, Spain',
  'Madrid, Spain',
  'Rome, Italy',
  'Milan, Italy',
  'Venice, Italy',
  'Amsterdam, Netherlands',
  'Berlin, Germany',
  'Munich, Germany',
  'Vienna, Austria',
  'Prague, Czech Republic',
  'Budapest, Hungary',
  'Lisbon, Portugal',
  'Athens, Greece',
  'Zurich, Switzerland',
  'Geneva, Switzerland',
  'Stockholm, Sweden',
  'Copenhagen, Denmark',
  'Oslo, Norway',
  'Brussels, Belgium',
  'Dublin, Ireland',
  'Edinburgh, United Kingdom',
  'Warsaw, Poland',
  
  // American cities
  'New York, USA',
  'Los Angeles, USA',
  'Las Vegas, USA',
  'Miami, USA',
  'San Francisco, USA',
  'Chicago, USA',
  'Seattle, USA',
  'Boston, USA',
  'Washington DC, USA',
  'Toronto, Canada',
  'Vancouver, Canada',
  'Montreal, Canada',
  'Mexico City, Mexico',
  'Cancun, Mexico',
  'Buenos Aires, Argentina',
  'Rio de Janeiro, Brazil',
  'São Paulo, Brazil',
  'Lima, Peru',
  'Bogotá, Colombia',
  'Santiago, Chile',
  
  // Oceania cities
  'Sydney, Australia',
  'Melbourne, Australia',
  'Brisbane, Australia',
  'Perth, Australia',
  'Auckland, New Zealand',
  'Wellington, New Zealand',
  
  // African & Middle Eastern cities
  'Cairo, Egypt',
  'Cape Town, South Africa',
  'Johannesburg, South Africa',
  'Marrakech, Morocco',
  'Nairobi, Kenya',
  
  // Asian countries
  'Japan',
  'Singapore',
  'South Korea',
  'Thailand',
  'Malaysia',
  'China',
  'Taiwan',
  'Philippines',
  'Indonesia',
  'Vietnam',
  'India',
  'UAE',
  'Qatar',
  'Saudi Arabia',
  'Israel',
  'Turkey',
  'Sri Lanka',
  'Nepal',
  'Cambodia',
  'Myanmar',
  'Maldives',
  'Brunei',
  'Laos',
  'Mongolia',
  'France',
  'United Kingdom',
  'Spain',
  'Italy',
  'Germany',
  'Netherlands',
  'Austria',
  'Switzerland',
  'USA',
  'Canada',
  'Mexico',
  'Australia',
  'New Zealand',
  'Brazil',
  'Argentina',
  'Greece',
  'Portugal',
  'Belgium',
  'Sweden',
  'Norway',
  'Denmark',
  'Ireland',
  'Czech Republic',
  'Poland',
  'Hungary',
  'Egypt',
  'South Africa',
  'Morocco',
].sort();

export function ContextInputScreen({ initialData, onSubmit }: ContextInputScreenProps) {
  const [formData, setFormData] = useState<ContextData>(initialData);
  const [showDestinations, setShowDestinations] = useState(false);
  const [filteredDestinations, setFilteredDestinations] = useState(popularDestinations);
  const destinationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (destinationRef.current && !destinationRef.current.contains(event.target as Node)) {
        setShowDestinations(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDestinationChange = (value: string) => {
    setFormData({ ...formData, destination: value });
    
    // Filter destinations
    const filtered = popularDestinations.filter(dest =>
      dest.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredDestinations(filtered);
    setShowDestinations(true);
  };

  const selectDestination = (destination: string) => {
    setFormData({ ...formData, destination });
    setShowDestinations(false);
  };

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
            <div className="relative" ref={destinationRef}>
              <div className="relative">
                <Input
                  id="destination"
                  placeholder="Search or type a destination..."
                  value={formData.destination}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  onFocus={() => setShowDestinations(true)}
                  className="h-12 pr-10"
                  autoComplete="off"
                />
                <ChevronDown 
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
                />
              </div>
              
              {showDestinations && filteredDestinations.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredDestinations.map((destination) => (
                    <button
                      key={destination}
                      type="button"
                      onClick={() => selectDestination(destination)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 transition-colors flex items-center gap-2 border-b border-neutral-100 last:border-b-0"
                    >
                      <MapPin className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                      <span>{destination}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
