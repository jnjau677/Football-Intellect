import { z } from 'zod';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  leagues: {
    list: {
      method: 'GET' as const,
      path: '/api/leagues',
      responses: {
        200: z.array(z.custom<any>()),
      },
    },
  },
  matches: {
    list: {
      method: 'GET' as const,
      path: '/api/matches',
      input: z.object({ leagueId: z.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<any>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/matches/:id',
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
      },
    },
    predict: {
      method: 'POST' as const,
      path: '/api/matches/:id/predict',
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    },
  },
  teams: {
    list: {
      method: 'GET' as const,
      path: '/api/teams',
      input: z.object({ leagueId: z.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<any>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/teams/:id',
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
      },
    },
  },
};

// ============================================
// HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
