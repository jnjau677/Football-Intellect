import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { rateLimitMiddleware } from "./middleware";
import type { InsertTeam, MatchWithDetails, Team } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Zero-Trust validation schemas
const leagueSchema = z.object({
  name: z.string().min(2).max(100),
  country: z.string().min(2).max(100),
  logoUrl: z.string().url().optional(),
});

const matchQuerySchema = z.object({
  leagueId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const idParamSchema = z.coerce.number().int().positive();

/**
 * Zod schema for validating AI prediction response shape.
 * Guardian Fix: Never trust raw JSON.parse output from an LLM.
 */
const aiPredictionResponseSchema = z.object({
  analysis: z.string().default("Analysis unavailable"),
  prediction: z.string().default("Unknown"),
  confidence: z.number().min(0).max(100).default(75),
  homeWinChance: z.number().min(0).max(100).optional(),
  drawChance: z.number().min(0).max(100).optional(),
  awayWinChance: z.number().min(0).max(100).optional(),
  keyInsights: z.array(z.string()).max(10).optional(),
});

// In-flight prediction lock to prevent duplicate concurrent requests
const predictionLocks = new Set<number>();

/**
 * Seed database with initial data
 * Runs only once on startup
 */
async function seedDatabase() {
  try {
    const leagues = await storage.getLeagues();
    if (leagues.length > 0) {
      console.log("[Database] Skipping seed - data already exists");
      return;
    }

    console.log("[Database] Seeding initial data...");

    // Create leagues
    const pl = await storage.createLeague({
      name: "Premier League",
      country: "England",
      logoUrl: "https://resources.premierleague.com/premierleague/logos/PL-logo.svg",
    });

    // Create teams for Premier League with proper typing
    // Guardian Fix: Use camelCase field names matching the Drizzle schema columns
    const plTeams: InsertTeam[] = [
      {
        leagueId: pl.id,
        name: "Arsenal",
        position: 1,
        matchesPlayed: 34,
        wins: 21,
        draws: 8,
        losses: 5,
        goalsFor: 68,
        goalsAgainst: 32,
        points: 71,
        form: ["W", "W", "D", "W", "L"],
      },
      {
        leagueId: pl.id,
        name: "Liverpool",
        position: 2,
        matchesPlayed: 34,
        wins: 20,
        draws: 8,
        losses: 6,
        goalsFor: 72,
        goalsAgainst: 28,
        points: 68,
        form: ["W", "W", "W", "D", "W"],
      },
    ];

    const teams = [];
    for (const team of plTeams) {
      teams.push(await storage.createTeam(team));
    }

    // Create sample matches
    const now = new Date();
    await storage.createMatch({
      leagueId: pl.id,
      homeTeamId: teams[0].id,
      awayTeamId: teams[1].id,
      homeScore: 2,
      awayScore: 1,
      status: "live",
      minute: 67,
      startTime: now,
      homeShots: 8,
      awayShots: 5,
      homePossession: 55.2,
      awayPossession: 44.8,
    });

    console.log("[Database] Seed completed successfully");
  } catch (error) {
    console.error("[Database] Seed failed:", error);
    throw error;
  }
}

/**
 * Sanitize a string for safe inclusion in an AI prompt.
 * Guardian Fix: Prevents prompt injection via team names or other user-sourced data.
 */
function sanitizeForPrompt(value: string, maxLength = 50): string {
  return value
    .replace(/[\n\r]/g, " ")
    .replace(/[^a-zA-Z0-9 .'-]/g, "")
    .slice(0, maxLength)
    .trim();
}

/**
 * Generate AI prediction with full type safety and validated output.
 * Guardian Fix: Typed params, sanitized prompt, Zod-validated AI response.
 */
async function generateSmartPrediction(
  _match: MatchWithDetails,
  homeTeam: Team,
  awayTeam: Team
): Promise<z.infer<typeof aiPredictionResponseSchema>> {
  const matchesPlayed = (t: Team) => t.matchesPlayed ?? 0;
  const wins = (t: Team) => t.wins ?? 0;

  const homeWinRate = matchesPlayed(homeTeam) > 0
    ? ((wins(homeTeam) / matchesPlayed(homeTeam)) * 100).toFixed(0)
    : "0";
  const awayWinRate = matchesPlayed(awayTeam) > 0
    ? ((wins(awayTeam) / matchesPlayed(awayTeam)) * 100).toFixed(0)
    : "0";

  const safeName = (t: Team) => sanitizeForPrompt(t.name);
  const safeForm = (t: Team) => (t.form ?? []).map(f => sanitizeForPrompt(f, 1)).join("");

  const prompt = `You are an expert football analyst. Analyze this match and provide predictions.

HOME: ${safeName(homeTeam)} (Pos: ${homeTeam.position ?? "N/A"}, Pts: ${homeTeam.points ?? 0}, Win%: ${homeWinRate}%, Form: ${safeForm(homeTeam)})
AWAY: ${safeName(awayTeam)} (Pos: ${awayTeam.position ?? "N/A"}, Pts: ${awayTeam.points ?? 0}, Win%: ${awayWinRate}%, Form: ${safeForm(awayTeam)})

Return ONLY valid JSON with: analysis (2 sentences), prediction (Home Win|Draw|Away Win), confidence (75-95), homeWinChance, drawChance, awayWinChance, keyInsights (3 insights).`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_completion_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return aiPredictionResponseSchema.parse({});
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("[AI] Failed to parse AI response as JSON:", content.slice(0, 200));
    return aiPredictionResponseSchema.parse({});
  }

  return aiPredictionResponseSchema.parse(parsed);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database
  await seedDatabase();

  /**
   * GET /api/leagues
   * Returns all available leagues
   */
  app.get(api.leagues.list.path, async (req, res, next) => {
    try {
      const leagues = await storage.getLeagues();
      res.json(leagues);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/matches
   * Returns matches with optional filtering and pagination
   */
  app.get(api.matches.list.path, async (req, res, next) => {
    try {
      const { leagueId, limit, offset } = matchQuerySchema.parse(req.query);
      const matches = await storage.getMatches(leagueId, limit, offset);
      res.json(matches);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/matches/:id
   * Returns a single match with details and prediction
   */
  app.get(api.matches.get.path, async (req, res, next) => {
    try {
      const parseResult = idParamSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid match ID" });
      }

      const match = await storage.getMatch(parseResult.data);
      if (!match) return res.status(404).json({ message: "Match not found" });
      res.json(match);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/matches/:id/predict
   * Generate AI prediction for a match (rate limited)
   */
  app.post(
    api.matches.predict.path,
    rateLimitMiddleware(60000, 10),
    async (req, res, next) => {
      try {
        const parseResult = idParamSchema.safeParse(req.params.id);
        if (!parseResult.success) {
          return res.status(400).json({ message: "Invalid match ID" });
        }
        const id = parseResult.data;

        const match = await storage.getMatch(id);
        if (!match) return res.status(404).json({ message: "Match not found" });

        // Check if prediction already exists (avoid regenerating)
        const existing = await storage.getPrediction(id);
        if (existing) return res.json(existing);

        // Guardian Fix: Mutex lock prevents duplicate predictions from concurrent requests (TOCTOU race)
        if (predictionLocks.has(id)) {
          return res.status(409).json({ message: "Prediction is being generated. Please retry shortly." });
        }
        predictionLocks.add(id);

        try {
          // Double-check after acquiring lock
          const recheck = await storage.getPrediction(id);
          if (recheck) {
            return res.json(recheck);
          }

          const result = await generateSmartPrediction(
            match,
            match.homeTeam,
            match.awayTeam
          );

          const prediction = await storage.createPrediction({
            matchId: id,
            analysis: result.analysis,
            prediction: result.prediction,
            confidence: result.confidence,
            homeWinChance: result.homeWinChance,
            drawChance: result.drawChance,
            awayWinChance: result.awayWinChance,
            keyInsights: result.keyInsights,
          });

          res.json(prediction);
        } finally {
          predictionLocks.delete(id);
        }
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/teams
   * Returns all teams or teams from a specific league
   */
  app.get(api.teams.list.path, async (req, res, next) => {
    try {
      const leagueIdParam = req.query.leagueId;
      let leagueId: number | undefined;
      if (leagueIdParam !== undefined) {
        const parsed = idParamSchema.safeParse(leagueIdParam);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid leagueId" });
        }
        leagueId = parsed.data;
      }
      const teams = await storage.getTeams(leagueId);
      res.json(teams);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/teams/:id
   * Returns a single team with league info
   */
  app.get(api.teams.get.path, async (req, res, next) => {
    try {
      const parseResult = idParamSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid team ID" });
      }

      const team = await storage.getTeam(parseResult.data);
      if (!team) return res.status(404).json({ message: "Team not found" });
      res.json(team);
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
