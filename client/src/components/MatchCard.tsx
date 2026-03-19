import { Link } from "wouter";
import { type MatchWithTeams } from "@shared/schema";
import { format } from "date-fns";
import { Timer, Trophy, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MatchCardProps {
  match: MatchWithTeams;
}

export function MatchCard({ match }: MatchCardProps) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  
  // Format score for display
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;

  return (
    <Link href={`/match/${match.id}`}>
      <motion.div 
        whileHover={{ y: -4 }}
        className="group relative bg-card border border-border/50 rounded-2xl p-5 cursor-pointer hover:border-primary/50 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-primary/5 overflow-hidden"
      >
        {/* Background Gradient for AI Predicted Matches */}
        {match.prediction && (
          <div className="absolute top-0 right-0 p-2">
            <div className="bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <BrainCircuit className="w-3 h-3" />
              AI ANALYZED
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Header: Status & Time */}
          <div className="flex justify-between items-center text-xs font-medium tracking-wider uppercase text-muted-foreground">
            <div className="flex items-center gap-2">
              {isLive ? (
                <div className="flex items-center gap-2 text-primary animate-pulse">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  LIVE • {match.minute}'
                </div>
              ) : isFinished ? (
                <span>Full Time</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5" />
                  {format(new Date(match.startTime), "MMM d • HH:mm")}
                </div>
              )}
            </div>
          </div>

          {/* Teams & Score */}
          <div className="flex items-center justify-between gap-4">
            {/* Home Team */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
                 {match.homeTeam.logoUrl ? (
                   <img src={match.homeTeam.logoUrl} alt={match.homeTeam.name} className="w-6 h-6 object-contain" />
                 ) : (
                   <span className="text-xs font-bold">{match.homeTeam.name.substring(0, 2).toUpperCase()}</span>
                 )}
              </div>
              <span className="font-semibold text-sm sm:text-base leading-tight">
                {match.homeTeam.name}
              </span>
            </div>

            {/* Score Display */}
            <div className={cn(
              "flex flex-col items-center justify-center px-4 py-2 rounded-xl min-w-[80px]",
              isLive ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted/50 text-foreground border border-border"
            )}>
              <div className="text-2xl font-display font-bold tabular-nums">
                {isLive || isFinished ? (
                  `${homeScore} - ${awayScore}`
                ) : (
                  "vs"
                )}
              </div>
            </div>

            {/* Away Team */}
            <div className="flex items-center gap-3 flex-1 justify-end text-right">
              <span className="font-semibold text-sm sm:text-base leading-tight">
                {match.awayTeam.name}
              </span>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
                 {match.awayTeam.logoUrl ? (
                   <img src={match.awayTeam.logoUrl} alt={match.awayTeam.name} className="w-6 h-6 object-contain" />
                 ) : (
                   <span className="text-xs font-bold">{match.awayTeam.name.substring(0, 2).toUpperCase()}</span>
                 )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
