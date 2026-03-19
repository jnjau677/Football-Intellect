import { db } from "./db";
import { eq, inArray } from "drizzle-orm";
import {
  matches, teams, predictions, leagues,
  type Match, type Team, type Prediction, type League,
  type InsertMatch, type InsertTeam, type InsertPrediction, type InsertLeague,
  type MatchWithDetails, type TeamWithLeague
} from "@shared/schema";
import { leaguesCache, teamsCache } from "./cache";

export interface IStorage {
  getLeagues(): Promise<League[]>;
  createLeague(league: InsertLeague): Promise<League>;
  getTeams(leagueId?: number): Promise<TeamWithLeague[]>;
  getTeam(id: number): Promise<TeamWithLeague | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  getMatches(leagueId?: number, limit?: number, offset?: number): Promise<MatchWithDetails[]>;
  getMatch(id: number): Promise<MatchWithDetails | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  createPrediction(prediction: InsertPrediction): Promise<Prediction>;
  getPrediction(matchId: number): Promise<Prediction | undefined>;
  updateMatch(id: number, updates: Partial<Match>): Promise<Match>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Get all leagues with caching (5 min TTL)
   */
  async getLeagues(): Promise<League[]> {
    const cached = leaguesCache.get("all_leagues") as League[] | undefined;
    if (cached) return cached;

    const result = await db.select().from(leagues);
    leaguesCache.set("all_leagues", result);
    return result;
  }

  async createLeague(league: InsertLeague): Promise<League> {
    const [newLeague] = await db.insert(leagues).values(league).returning();
    leaguesCache.invalidate("all_leagues");
    return newLeague;
  }

  /**
   * Get teams with league data using optimized joins
   * Optionally filter by league and cache results
   */
  async getTeams(leagueId?: number): Promise<TeamWithLeague[]> {
    const cacheKey = leagueId ? `teams_league_${leagueId}` : "teams_all";
    const cached = teamsCache.get(cacheKey) as TeamWithLeague[] | undefined;
    if (cached) return cached;

    let query = db.select().from(teams);
    if (leagueId) {
      query = query.where(eq(teams.leagueId, leagueId));
    }

    const allTeams = await query;
    const leaguesMap = new Map<number, League>();

    // Fetch all unique leagues
    const uniqueLeagueIds = [...new Set(allTeams.map((t) => t.leagueId))];
    for (const id of uniqueLeagueIds) {
      const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
      if (league) leaguesMap.set(id, league);
    }

    const results = allTeams
      .map((team) => {
        const league = leaguesMap.get(team.leagueId);
        return league ? { ...team, league } : null;
      })
      .filter((item): item is TeamWithLeague => item !== null)
      .sort((a, b) => (a.position || 999) - (b.position || 999));

    teamsCache.set(cacheKey, results);
    return results;
  }

  async getTeam(id: number): Promise<TeamWithLeague | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    if (!team) return undefined;

    const [league] = await db.select().from(leagues).where(eq(leagues.id, team.leagueId));
    return league ? { ...team, league } : undefined;
  }

  /**
   * Create team with proper validation
   */
  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    teamsCache.invalidate(`teams_league_${team.leagueId}`);
    teamsCache.invalidate("teams_all");
    return newTeam;
  }

  /**
   * Get matches with pagination and optimized joins
   */
  async getMatches(
    leagueId?: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<MatchWithDetails[]> {
    let query = db.select().from(matches);
    if (leagueId) {
      query = query.where(eq(matches.leagueId, leagueId));
    }

    // Apply pagination
    const allMatches = await query.limit(limit).offset(offset);
    const leaguesMap = new Map<number, League>();
    const teamsMap = new Map<number, Team>();

    // Batch fetch unique leagues and teams
    const uniqueLeagueIds = [...new Set(allMatches.map((m) => m.leagueId))];
    const uniqueTeamIds = [
      ...new Set(allMatches.flatMap((m) => [m.homeTeamId, m.awayTeamId])),
    ];

    for (const id of uniqueLeagueIds) {
      const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
      if (league) leaguesMap.set(id, league);
    }

    for (const id of uniqueTeamIds) {
      const [team] = await db.select().from(teams).where(eq(teams.id, id));
      if (team) teamsMap.set(id, team);
    }

    // Fetch all predictions for these matches
    const matchIds = allMatches.map((m) => m.id);
    let predictionsMap = new Map<number, Prediction>();
    if (matchIds.length > 0) {
      const allPredictions = await db.select().from(predictions).where(
        inArray(predictions.matchId, matchIds)
      );
      predictionsMap = new Map(allPredictions.map((p) => [p.matchId, p]));
    }

    const results = allMatches
      .map((match) => {
        const league = leaguesMap.get(match.leagueId);
        const homeTeam = teamsMap.get(match.homeTeamId);
        const awayTeam = teamsMap.get(match.awayTeamId);
        const prediction = predictionsMap.get(match.id);

        return league && homeTeam && awayTeam
          ? { ...match, league, homeTeam, awayTeam, prediction }
          : null;
      })
      .filter((item): item is MatchWithDetails => item !== null);

    return results.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async getMatch(id: number): Promise<MatchWithDetails | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return undefined;

    const [league] = await db.select().from(leagues).where(eq(leagues.id, match.leagueId));
    const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
    const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));
    const [prediction] = await db.select().from(predictions).where(eq(predictions.matchId, match.id));

    if (league && homeTeam && awayTeam) {
      return { ...match, league, homeTeam, awayTeam, prediction };
    }
    return undefined;
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [newMatch] = await db.insert(matches).values(match).returning();
    return newMatch;
  }

  async createPrediction(prediction: InsertPrediction): Promise<Prediction> {
    const [newPrediction] = await db.insert(predictions).values(prediction).returning();
    return newPrediction;
  }

  async getPrediction(matchId: number): Promise<Prediction | undefined> {
    const [prediction] = await db.select().from(predictions).where(eq(predictions.matchId, matchId));
    return prediction;
  }

  async updateMatch(id: number, updates: Partial<Match>): Promise<Match> {
    const [updated] = await db.update(matches).set(updates).where(eq(matches.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
