"use client";
import React, { useState, useEffect, useRef } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { 
  Search, 
  Clock, 
  Calendar, 
  Tv, 
  BookOpen, 
  Film, 
  Zap, 
  ChevronRight, 
  X, 
  Sparkles, 
  Settings, 
  Check, 
  AlertCircle,
  Menu,
  Edit2,
  Loader2
} from 'lucide-react';

/**
 * --- LIB / UTILS SECTION ---
 * Helper functions normally found in lib/utils.ts
 */

const formatDuration = (minutes: number) => {
  if (isNaN(minutes)) return "0m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.floor(minutes % 60);

  let result = "";
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (mins > 0 || result === "") result += `${mins}m`;
  return result.trim();
};

const calculateDaysToFinish = (totalMinutes: number, hoursPerDay: number) => {
  if (hoursPerDay <= 0) return Infinity;
  const minutesPerDay = hoursPerDay * 60;
  return Math.ceil(totalMinutes / minutesPerDay);
};

const calculateDailyHoursNeeded = (totalMinutes: number, deadlineDate: string) => {
  const today = new Date();
  const deadline = new Date(deadlineDate);
  const diffTime = Math.abs(deadline.getTime() - today.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays <= 0) return totalMinutes / 60; // Due today/past
  return (totalMinutes / 60) / diffDays;
};

/**
 * --- MOCK DATA & TYPES ---
 * Mock data for TMDB fallback (since we don't have a backend proxy for secrets)
 */

type ContentType = 'watch' | 'read';

interface ContentItem {
  id: string | number;
  title: string;
  poster: string;
  type: 'movie' | 'tv' | 'book';
  // Common
  overview: string;
  releaseDate: string;
  rating: number;
  // TV/Movie Specific
  runtime?: number; // minutes per ep or total movie
  totalDuration?: number; // EXACT total minutes for TV (sum of all eps)
  episodes?: number;
  seasons?: number;
  // Book Specific
  pages?: number;
  authors?: string[];
}

const MOCK_TMDB_RESULTS: ContentItem[] = [
  {
    id: 1,
    title: "Breaking Bad",
    poster: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    type: 'tv',
    overview: "When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of two years left to live. He becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost as he enters the dangerous world of drugs and crime.",
    releaseDate: "2008-01-20",
    rating: 9.5,
    episodes: 62,
    seasons: 5,
    totalDuration: 2980 // Approx for mock
  },
  {
    id: 2,
    title: "Inception",
    poster: "https://image.tmdb.org/t/p/w500/9gk7admal4zl248sKDTFn2E16m6.jpg",
    type: 'movie',
    overview: "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: \"inception\", the implantation of another person's idea into a target's subconscious.",
    releaseDate: "2010-07-15",
    rating: 8.8,
    runtime: 148
  },
  {
    id: 3,
    title: "Stranger Things",
    poster: "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
    type: 'tv',
    overview: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
    releaseDate: "2016-07-15",
    rating: 8.6,
    episodes: 34,
    seasons: 4,
    totalDuration: 2050 // Mock approx
  },
  {
    id: 4,
    title: "Dune: Part Two",
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    type: 'movie',
    overview: "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.",
    releaseDate: "2024-02-27",
    rating: 8.4,
    runtime: 166
  }
];

/**
 * --- COMPONENTS ---
 */

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = "violet" }: { children: React.ReactNode, color?: "violet" | "cyan" | "amber" }) => {
  const colors = {
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- API Service Simulation ---
const searchContent = async (query: string, type: ContentType, tmdbKey: string): Promise<ContentItem[]> => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network latency

  if (type === 'read') {
    // Real Google Books API call
    try {
      // Increased maxResults to 20 to find more relevant series/box sets
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20`);
      const data = await res.json();
      
      if (data.items) {
        return data.items
          .map((book: any) => {
            // Construct high-res image URL manually if ID exists, fallback to thumbnail but clean it
            const id = book.id;
            let poster = `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=3&source=gbs_api`;
            
            if (!book.volumeInfo.imageLinks) {
                poster = "https://via.placeholder.com/300x450?text=No+Cover";
            } 

            return {
              id: book.id,
              title: book.volumeInfo.title,
              poster: poster,
              type: 'book',
              overview: book.volumeInfo.description || "No description available.",
              releaseDate: book.volumeInfo.publishedDate,
              rating: book.volumeInfo.averageRating || 0,
              pages: book.volumeInfo.pageCount || 0,
              authors: book.volumeInfo.authors || ["Unknown"]
            };
          })
          .filter((book: ContentItem) => {
             if (!book.pages || book.pages === 0) return false;
             
             const titleLower = book.title.toLowerCase();
             if ((titleLower.includes("set") || titleLower.includes("collection") || titleLower.includes("trilogy") || titleLower.includes("series")) && (book.pages || 0) < 200) {
                 return false; 
             }
             return true;
          });
      }
      return [];
    } catch (e) {
      console.error("Books API Error", e);
      return [];
    }
  } else {
    // TMDB Search
    if (tmdbKey) {
       // If user provided key, try real fetch
       try {
         const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`);
         const data = await res.json();
         // Map to our format, filtering only movies/tv
         return data.results
            .filter((i: any) => i.media_type === 'tv' || i.media_type === 'movie')
            .slice(0, 8)
            .map((i: any) => ({
              id: i.id,
              title: i.title || i.name,
              poster: i.poster_path ? `https://image.tmdb.org/t/p/w500${i.poster_path}` : "https://via.placeholder.com/300x450?text=No+Poster",
              type: i.media_type,
              overview: i.overview,
              releaseDate: i.release_date || i.first_air_date,
              rating: i.vote_average,
              episodes: undefined, // Don't guess in search results
              seasons: undefined,  // Don't guess in search results (Fixes "1 Season" bug)
              runtime: i.media_type === 'movie' ? 120 : 45
            }));
       } catch (e) {
         return MOCK_TMDB_RESULTS.filter(i => i.title.toLowerCase().includes(query.toLowerCase()));
       }
    } else {
      // Return mock data filtered by query
      return MOCK_TMDB_RESULTS.filter(i => i.title.toLowerCase().includes(query.toLowerCase()));
    }
  }
};

/**
 * --- MAIN APP COMPONENT ---
 */

export default function ContentCompass() {
  // SEO Optimization: Dynamically set document title for better search visibility
  useEffect(() => {
    document.title = "How Long to Finish - Movie, TV & Book Time Calculator";
  }, []);

  // State
  const [activeTab, setActiveTab] = useState<ContentType>('watch');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  
  // API Keys (Hardcoded as requested)
  // Note: Hardcoding keys in client-side code is generally not recommended for production security.
  const [tmdbKey] = useState("f3e230b65394a80b4f443fad331df3aa");
  const [geminiKey] = useState("AIzaSyB2Xyz6AzYodK7fslLZ8J5RQLkSI8531II");

  // Calculator State
  const [skipIntro, setSkipIntro] = useState(false); // TV - Changed default to FALSE
  const [readingSpeed, setReadingSpeed] = useState(250); // Books WPM
  const [dailyBudget, setDailyBudget] = useState(5); // Hours
  const [deadline, setDeadline] = useState("");
  
  // Manual Overrides
  const [manualPages, setManualPages] = useState<number | null>(null);
  const [manualRuntime, setManualRuntime] = useState<number | null>(null);
  const [isEditingStats, setIsEditingStats] = useState(false);

  // Scheduler State
  const [chatInput, setChatInput] = useState("");
  const [scheduleResult, setScheduleResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New Loading State
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Reset manual stats when item changes
  useEffect(() => {
    setManualPages(null);
    setManualRuntime(null);
    setIsEditingStats(false);
    setSkipIntro(false); // Reset skip intro to false on new item
  }, [selectedItem]);

  // --- Item Selection with Detail Fetch ---
  const handleItemSelect = async (item: ContentItem) => {
    setIsLoadingDetails(true);
    let finalItem = { ...item };

    // Fetch details if we have an API key to get accurate season/episode counts
    if (tmdbKey && (item.type === 'tv' || item.type === 'movie')) {
       try {
          const res = await fetch(`https://api.themoviedb.org/3/${item.type}/${item.id}?api_key=${tmdbKey}`);
          if (res.ok) {
            const data = await res.json();
            
            if (item.type === 'movie') {
                finalItem.runtime = data.runtime || item.runtime;
            } 
            else if (item.type === 'tv') {
                finalItem.seasons = data.number_of_seasons || item.seasons;
                // Don't rely on data.number_of_episodes for exact runtime calc, we will count them ourselves below
                
                // --- EXACT RUNTIME CALCULATION ---
                // We must fetch EVERY season to sum the exact episode runtimes.
                // Filter out season 0 (Specials) usually, unless user wants them. Sticking to Season 1+ for main binge.
                if (data.seasons) {
                    const seasonFetches = data.seasons
                        .filter((s: any) => s.season_number > 0)
                        .map((s: any) => 
                            fetch(`https://api.themoviedb.org/3/tv/${item.id}/season/${s.season_number}?api_key=${tmdbKey}`)
                                .then(r => r.ok ? r.json() : null)
                                .catch(err => null)
                        );
                    
                    const seasonsData = await Promise.all(seasonFetches);
                    
                    let exactTotalMinutes = 0;
                    let exactTotalEpisodes = 0;
                    
                    seasonsData.forEach((season: any) => {
                        if (season && season.episodes) {
                            season.episodes.forEach((ep: any) => {
                                // Add this episode's runtime. If missing, fallback to avg or 45
                                const epRuntime = ep.runtime || (data.episode_run_time?.[0] || 45);
                                exactTotalMinutes += epRuntime;
                                exactTotalEpisodes++;
                            });
                        }
                    });

                    // Update item with precise data
                    if (exactTotalMinutes > 0) {
                        finalItem.totalDuration = exactTotalMinutes;
                        finalItem.episodes = exactTotalEpisodes;
                    }
                }
            } 
          }
       } catch (e) {
          console.error("Detail fetch failed", e);
       }
    }

    setSelectedItem(finalItem);
    setSearchQuery("");
    setResults([]);
    setIsLoadingDetails(false);
  };

  // --- Search Handler ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        const data = await searchContent(searchQuery, activeTab, tmdbKey);
        setResults(data);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab, tmdbKey]);

  // --- Calculation Logic ---
  const calculateTotalMinutes = (item: ContentItem) => {
    // 1. Check for manual overrides first
    if (manualRuntime !== null) return manualRuntime; 
    
    // For Books
    if (item.type === 'book') {
        const pagesToUse = manualPages !== null ? manualPages : (item.pages || 0);
        const totalWords = pagesToUse * 275;
        return Math.ceil(totalWords / readingSpeed);
    }

    // Default Logic for Watch
    // If we have an EXACT total duration (from deep fetch), use it.
    if (item.totalDuration) {
        // Apply skip intro logic to the GRAND TOTAL
        if (item.type === 'tv' && skipIntro) {
            // Subtract 2.5 mins for every episode found
            const totalReduction = (item.episodes || 0) * 2.5;
            return Math.max(0, Math.round(item.totalDuration - totalReduction));
        }
        return item.totalDuration;
    }

    // Fallback if no exact duration found
    if (item.type === 'movie') return item.runtime || 0;
    if (item.type === 'tv') {
      const perEp = (item.runtime || 45) - (skipIntro ? 2.5 : 0);
      return (item.episodes || 0) * perEp;
    }
    return 0;
  };

  const totalMinutes = selectedItem ? calculateTotalMinutes(selectedItem) : 0;
  const daysToFinish = calculateDaysToFinish(totalMinutes, dailyBudget);
  const hoursNeededForDeadline = deadline ? calculateDailyHoursNeeded(totalMinutes, deadline) : 0;
  
  // Display helper for pages
  const displayPages = manualPages !== null ? manualPages : selectedItem?.pages || 0;

  // --- AI Scheduler Logic ---
  const generateSchedule = async () => {
    if (!selectedItem || !geminiKey) {
      alert("Please select an item and ensure Gemini API Key is saved in Settings.");
      return;
    }
    setIsGenerating(true);
    setScheduleResult("");

    const itemDetails = `${selectedItem.title} (${selectedItem.type}). Total Duration: ${formatDuration(totalMinutes)}.`;
    const constraints = `User constraints: Has ${dailyBudget} hours per day. ${deadline ? `Must finish by ${deadline}.` : ''} Additional notes: ${chatInput}`;
    
    // UPDATED PROMPT: Request HTML Table
    const prompt = `
      Create a viewing/reading schedule for: ${itemDetails}.
      ${constraints}
      
      Output Rules:
      1. Do NOT use Markdown. Do NOT use code blocks (like \`\`\`html). Return ONLY raw HTML.
      2. Format the schedule as a HTML Table with these exact Tailwind classes:
         - <table class="w-full text-sm text-left border-collapse my-4">
         - <th class="p-3 bg-white/10 text-violet-300 font-semibold rounded-t-lg">
         - <td class="p-3 border-b border-white/10 text-slate-300">
         - <tr class="hover:bg-white/5 transition-colors">
      3. Add a motivating summary in a <p class="mt-4 text-slate-400 italic"> tag.
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate schedule.";
      
      // Cleanup any potential markdown fences just in case
      text = text.replace(/```html/g, '').replace(/```/g, '');
      
      setScheduleResult(text);
    } catch (error) {
      setScheduleResult("Error connecting to Gemini. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => {setSelectedItem(null); setSearchQuery("");}}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {/* SEO Optimization: Title with keywords in header (also functions as home link) */}
            <span className="font-bold text-lg md:text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 cursor-pointer">
              How Long to Finish
            </span>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-24 pb-20 px-4 max-w-7xl mx-auto">
        
        {selectedItem ? (
          // --- DETAIL DASHBOARD ---
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => setSelectedItem(null)}
              className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" /> Close Dashboard
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Poster & Metadata */}
              <div className="lg:col-span-4 space-y-6">
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/20 group bg-slate-900">
                  <img src={selectedItem.poster} alt={selectedItem.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h1 className="text-3xl font-bold text-white leading-tight mb-2 drop-shadow-lg">{selectedItem.title}</h1>
                    <div className="flex flex-wrap gap-2">
                      <Badge color={selectedItem.type === 'book' ? 'amber' : 'cyan'}>
                        {selectedItem.type.toUpperCase()}
                      </Badge>
                      <Badge color="violet">{selectedItem.rating} ★</Badge>
                      <span className="text-xs text-slate-300 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
                        {selectedItem.releaseDate ? new Date(selectedItem.releaseDate).getFullYear() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <Card>
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Synopsis</h3>
                  <p className="text-slate-300 leading-relaxed text-sm">
                    {selectedItem.overview.length > 500 ? selectedItem.overview.substring(0, 500) + "..." : selectedItem.overview}
                  </p>
                </Card>
              </div>

              {/* Right Column: Calculator & Tools */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 1. The Stats Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-gradient-to-br from-violet-900/20 to-slate-900/60 border-violet-500/20 relative group">
                    <button 
                       onClick={() => setIsEditingStats(!isEditingStats)}
                       className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                       title="Edit Total Count"
                    >
                       <Edit2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-violet-400" />
                      <h3 className="font-semibold text-white">Total Time</h3>
                    </div>
                    
                    <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-white">
                      {formatDuration(totalMinutes)}
                    </p>

                    <div className="text-xs text-slate-400 mt-1">
                      {isEditingStats ? (
                         <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-white/10">
                            <label className="block mb-1 text-slate-300">
                               {selectedItem.type === 'book' ? 'Total Pages:' : 'Total Minutes:'}
                            </label>
                            {selectedItem.type === 'book' ? (
                                <input 
                                   type="number" 
                                   value={displayPages}
                                   onChange={(e) => setManualPages(Number(e.target.value))}
                                   className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                                />
                            ) : (
                                <input 
                                   type="number" 
                                   value={manualRuntime !== null ? manualRuntime : totalMinutes}
                                   onChange={(e) => setManualRuntime(Number(e.target.value))}
                                   className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                                />
                            )}
                         </div>
                      ) : (
                         <>
                            {selectedItem.type === 'tv' 
                                ? `${selectedItem.seasons} Seasons • ${selectedItem.episodes} Episodes`
                                : selectedItem.type === 'book' 
                                ? `${displayPages} Pages` 
                                : 'Movie Runtime'}
                         </>
                      )}
                    </div>
                  </Card>

                  <Card className="bg-gradient-to-br from-cyan-900/20 to-slate-900/60 border-cyan-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                      <h3 className="font-semibold text-white">Completion</h3>
                    </div>
                    <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-white">
                      {daysToFinish} Days
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Based on {dailyBudget} hours/day
                    </p>
                  </Card>
                </div>

                {/* 2. Runtime Tuner */}
                <Card>
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-400" />
                    Runtime Tuner
                  </h3>
                  
                  <div className="space-y-6">
                    {/* TV Specific */}
                    {selectedItem.type === 'tv' && (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="space-y-1">
                          <span className="text-white font-medium">Skip Intro & Credits</span>
                          <p className="text-xs text-slate-400">Subtracts 2.5 mins per episode</p>
                        </div>
                        <button 
                          onClick={() => setSkipIntro(!skipIntro)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${skipIntro ? 'bg-violet-600' : 'bg-slate-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${skipIntro ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    )}

                    {/* Book Specific */}
                    {selectedItem.type === 'book' && (
                      <div className="space-y-4">
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-300">Reading Speed</span>
                           <span className="text-violet-300 font-mono">{readingSpeed} WPM</span>
                         </div>
                         <input 
                           type="range" 
                           min="150" 
                           max="600" 
                           step="10" 
                           value={readingSpeed}
                           onChange={(e) => setReadingSpeed(Number(e.target.value))}
                           className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                         />
                         <div className="flex justify-between text-xs text-slate-500">
                           <span>Slow (150)</span>
                           <span>Avg (250)</span>
                           <span>Fast (600)</span>
                         </div>
                      </div>
                    )}

                    {/* Universal Time Budget */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex justify-between text-sm">
                         <span className="text-slate-300">Daily Budget</span>
                         <span className="text-cyan-300 font-mono">{dailyBudget} Hours/Day</span>
                      </div>
                      <input 
                         type="range" 
                         min="0.5" 
                         max="24" 
                         step="0.5" 
                         value={dailyBudget}
                         onChange={(e) => setDailyBudget(Number(e.target.value))}
                         className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                       />
                    </div>

                     {/* Reverse Calc */}
                     <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/5 items-center">
                        <div className="w-full">
                          <label className="text-xs text-slate-400 mb-1 block">Have a deadline?</label>
                          <input 
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {deadline && (
                           <div className="w-full sm:w-auto bg-slate-800/50 p-3 rounded-lg border border-slate-700 whitespace-nowrap">
                              <span className="text-xs text-slate-400 block">You need to consume</span>
                              <span className="text-lg font-bold text-white">{hoursNeededForDeadline.toFixed(1)} hrs/day</span>
                           </div>
                        )}
                     </div>
                  </div>
                </Card>

                {/* 3. AI Scheduler */}
                <Card className="relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                     <Sparkles className="w-32 h-32 text-violet-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                    AI Scheduler
                  </h3>
                  
                  {!geminiKey ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-amber-200 font-medium">API Key Required</p>
                        <p className="text-amber-500/80 mt-1">Enter your Google Gemini API Key in settings to unlock smart scheduling.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="E.g., I work 9-5 and only watch TV on weekends..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-violet-500 min-h-[100px] resize-none"
                      />
                      <button 
                        onClick={generateSchedule}
                        disabled={isGenerating}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isGenerating ? (
                           <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Thinking...
                           </>
                        ) : (
                           <>
                             <Zap className="w-4 h-4" /> Generate Custom Schedule
                           </>
                        )}
                      </button>
                    </div>
                  )}

                  {scheduleResult && (
                    <div 
                      className="mt-6 p-4 bg-slate-950/50 rounded-xl border border-white/5 max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: scheduleResult }}
                    />
                  )}
                </Card>

              </div>
            </div>
          </div>
        ) : (
          // --- HERO / SEARCH HOME ---
          <div className="min-h-[70vh] flex flex-col items-center justify-center relative">
            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[120px] -z-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] -z-10 translate-y-20 translate-x-20" />

            <div className="text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-700">
              <div className="space-y-4">
                 {/* SEO Optimization: Keyword-rich H1 */}
                 <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
                   How Long to <br />
                   <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
                     Finish Your Obsession?
                   </span>
                 </h1>
                 {/* SEO Optimization: Descriptive subtitle targeting primary keywords */}
                 <p className="text-lg text-slate-400">
                   The ultimate Binge Watch & Reading Time Calculator. Find exact runtimes for Movies & TV Shows, and calculate reading time for Books based on your speed.
                 </p>
              </div>

              {/* Toggle */}
              <div className="inline-flex p-1 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full">
                <button 
                  onClick={() => { setActiveTab('watch'); setSearchQuery(""); setResults([]); }}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'watch' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50' : 'text-slate-400 hover:text-white'}`}
                >
                  <Tv className="w-4 h-4" /> Watch
                </button>
                <button 
                  onClick={() => { setActiveTab('read'); setSearchQuery(""); setResults([]); }}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'read' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50' : 'text-slate-400 hover:text-white'}`}
                >
                  <BookOpen className="w-4 h-4" /> Read
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full max-w-lg mx-auto group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-500" />
                <div className="relative flex items-center bg-slate-950 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                  <Search className="w-5 h-5 text-slate-500 ml-4" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'watch' ? "Search movies or TV shows..." : "Search books or series..."}
                    className="w-full bg-transparent p-4 text-white focus:outline-none placeholder:text-slate-600"
                  />
                  {isSearching && (
                    <div className="pr-4">
                      <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {isLoadingDetails && (
                    <div className="pr-4 flex items-center gap-2">
                       <span className="text-xs text-cyan-400 whitespace-nowrap hidden sm:block">Calculating exact runtime...</span>
                       <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Dropdown Results */}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden z-20 shadow-2xl animate-in fade-in slide-in-from-top-2 max-h-96 overflow-y-auto">
                    {results.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => handleItemSelect(item)}
                        className="p-3 flex items-center gap-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                      >
                        <img src={item.poster} alt={item.title} className="w-10 h-14 object-cover rounded-md bg-slate-800" />
                        <div className="text-left flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{item.title}</h4>
                          <p className="text-xs text-slate-400 truncate">
                            {item.releaseDate ? new Date(item.releaseDate).getFullYear() : 'N/A'} • {item.type.toUpperCase()}
                            {item.type === 'book' && item.pages ? ` • ${item.pages} Pages` : ''}
                            {item.type === 'tv' && item.seasons ? ` • ${item.seasons} Seasons` : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <SpeedInsights />
      </main>
    </div>
    
  );
}