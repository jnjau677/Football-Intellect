import { useMatches } from "@/hooks/use-matches";
import { MatchCard } from "@/components/MatchCard";
import { Header } from "@/components/Header";
import { CalendarDays, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { data: matches, isLoading, error } = useMatches();
  const [filter, setFilter] = useState<'all' | 'live' | 'finished' | 'scheduled'>('all');

  const filteredMatches = matches?.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const liveMatchesCount = matches?.filter(m => m.status === 'live').length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-card/50 rounded-2xl animate-pulse border border-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Matches</h2>
        <p className="text-muted-foreground">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
              Match Center
            </h1>
            <p className="text-muted-foreground">
              Live updates, statistics, and AI-powered match analysis.
            </p>
          </div>
          
          <div className="flex bg-card p-1 rounded-xl border border-border/50">
            {[
              { id: 'all', label: 'All' },
              { id: 'live', label: 'Live', count: liveMatchesCount },
              { id: 'scheduled', label: 'Upcoming' },
              { id: 'finished', label: 'Finished' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  filter === tab.id 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {tab.id === 'live' && tab.count > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Match List */}
        <div className="grid gap-4">
          {filteredMatches?.length === 0 ? (
            <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border">
              <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">No matches found</h3>
              <p className="text-muted-foreground">Try changing your filter selection</p>
            </div>
          ) : (
            filteredMatches?.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
