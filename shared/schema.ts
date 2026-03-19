import { pgTable, text, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  logoUrl: text("logo_url"),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  // Stats
  matchesPlayed: integer("matches_played").default(0),
  wins: integer("wins").default(0),
  draws: integer("draws").default(0),
  losses: integer("losses").default(0),
  goalsFor: integer("goals_for").default(0),
  goalsAgainst: integer("goals_against").default(0),
  points: integer("points").default(0),
  position: integer("position"),
  form: text("form").array(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull(),
  homeTeamId: integer("home_team_id").notNull(),
  awayTeamId: integer("away_team_id").notNull(),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  status: text("status").notNull(),
  minute: integer("minute").default(0),
  startTime: timestamp("start_time").notNull(),
  // Live stats
  homeShots: integer("home_shots").default(0),
  awayShots: integer("away_shots").default(0),
  homePossession: real("home_possession").default(0),
  awayPossession: real("away_possession").default(0),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  analysis: text("analysis").notNull(),
  prediction: text("prediction").notNull(),
  confidence: integer("confidence").notNull(),
  homeWinChance: integer("home_win_chance"),
  drawChance: integer("draw_chance"),
  awayWinChance: integer("away_win_chance"),
  keyInsights: text("key_insights").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===
export const insertLeagueSchema = createInsertSchema(leagues).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export const insertPredictionSchema = createInsertSchema(predictions).omit({ id: true, createdAt: true });

// === TYPES ===
export type League = typeof leagues.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;

export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;

export type MatchWithDetails = Match & {
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  prediction?: Prediction;
};

/** Alias for client compatibility */
export type MatchWithTeams = MatchWithDetails;

export type TeamWithLeague = Team & {
  league: League;
};
