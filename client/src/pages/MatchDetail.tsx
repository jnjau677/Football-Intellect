import { useMatch, usePredictMatch } from "@/hooks/use-matches";
import { Header } from "@/components/Header";
import { FormGuide } from "@/components/FormGuide";
import { useRoute, Link } from "wouter";
import { ChevronLeft, BrainCircuit, Activity, BarChart3, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const matchId = parseInt(params?.id || "0");
  
  const { data: match, isLoading, error } = useMatch(matchId);
  const predictMutation = usePredictMatch();
  
  const handlePredict = () => {
    if (match) predictMutation.mutate(match.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex justify-center pt-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-4">Match not found</h2>
        <Link href="/" className="text-primary hover:underline">Back to Home</Link>
      </div>
    );
  }

  const isLive = match.status === "live";

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to matches
        </Link>

        {/* Scoreboard */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl shadow-black/20 mb-8">
          {/* Match Info Bar */}
          <div className="bg-muted/30 px-6 py-3 border-b border-border/50 flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Premier League</span>
            <div className="flex items-center gap-2 font-medium">
              {isLive && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              <span className={isLive ? "text-primary" : "text-muted-foreground"}>
                {isLive ? `LIVE ${match.minute}'` : format(new Date(match.startTime), "MMMM d, yyyy • HH:mm")}
              </span>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
              
              {/* Home Team */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-background border-2 border-border p-4 mb-4 shadow-lg">
                  {match.homeTeam.logoUrl ? (
                    <img src={match.homeTeam.logoUrl} alt={match.homeTeam.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-muted-foreground">
                      {match.homeTeam.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">{match.homeTeam.name}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs uppercase tracking-wide">Form:</span>
                  <FormGuide form={match.homeTeam.form || []} />
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center">
                <div className="text-5xl md:text-7xl font-display font-bold tabular-nums tracking-tight mb-2">
                  {match.status === "scheduled" ? "VS" : `${match.homeScore} : ${match.awayScore}`}
                </div>
                {isLive && (
                  <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20 animate-pulse">
                    MATCH LIVE
                  </div>
                )}
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center text-center flex-1">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-background border-2 border-border p-4 mb-4 shadow-lg">
                  {match.awayTeam.logoUrl ? (
                    <img src={match.awayTeam.logoUrl} alt={match.awayTeam.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-muted-foreground">
                      {match.awayTeam.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">{match.awayTeam.name}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs uppercase tracking-wide">Form:</span>
                  <FormGuide form={match.awayTeam.form || []} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-card border border-border/50 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <BrainCircuit className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">AI Match Analysis</h3>
                  <p className="text-sm text-muted-foreground">Powered by advanced predictive models</p>
                </div>
              </div>

              {match.prediction ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="p-4 bg-background/50 rounded-xl border border-border text-foreground leading-relaxed">
                    {match.prediction.analysis}
                  </div>
                  
                  <div className="flex items-center gap-4 bg-accent/5 p-4 rounded-xl border border-accent/10">
                    <div className="flex-1">
                      <div className="text-xs text-accent font-bold uppercase tracking-wider mb-1">Prediction</div>
                      <div className="text-xl font-bold">{match.prediction.prediction}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Confidence</div>
                      <div className="text-2xl font-bold text-accent">{match.prediction.confidence}%</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 px-4">
                  <div className="mb-4">
                    <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  </div>
                  <h4 className="text-lg font-medium mb-2">No analysis generated yet</h4>
                  <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                    Generate an AI prediction based on team form, head-to-head stats, and current performance metrics.
                  </p>
                  <button
                    onClick={handlePredict}
                    disabled={predictMutation.isPending}
                    className="
                      px-6 py-3 rounded-xl font-semibold text-sm
                      bg-gradient-to-r from-accent to-accent/80
                      text-white shadow-lg shadow-accent/25
                      hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5
                      active:translate-y-0 active:shadow-md
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                      transition-all duration-200 ease-out flex items-center gap-2 mx-auto
                    "
                  >
                    {predictMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing Data...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="w-4 h-4" />
                        Generate Prediction
                      </>
                    )}
                  </button>
                  {predictMutation.isError && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      <span>Failed to generate prediction. Try again.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats Sidebar - Guardian Fix: Use actual match data instead of hardcoded values */}
          <div className="space-y-4">
            <div className="bg-card border border-border/50 rounded-2xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Key Stats
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between pb-2 border-b border-border/30">
                  <span className="text-muted-foreground">Possession</span>
                  <span className="font-medium">
                    {match.homePossession != null ? `${match.homePossession.toFixed(1)}%` : "—"} - {match.awayPossession != null ? `${match.awayPossession.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-border/30">
                  <span className="text-muted-foreground">Shots</span>
                  <span className="font-medium">
                    {match.homeShots ?? "—"} - {match.awayShots ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-border/30">
                  <span className="text-muted-foreground">Goals For (Season)</span>
                  <span className="font-medium">
                    {match.homeTeam.goalsFor ?? 0} - {match.awayTeam.goalsFor ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goals Against (Season)</span>
                  <span className="font-medium">
                    {match.homeTeam.goalsAgainst ?? 0} - {match.awayTeam.goalsAgainst ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
