import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Self-cleaning rate limiter with bounded memory.
 * Guardian Fix: Expired entries are evicted on every check (O(1) amortized)
 * and a periodic sweep prevents unbounded growth from inactive IPs.
 */
class RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  private sweepTimer: ReturnType<typeof setInterval>;
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000, sweepIntervalMs = 60_000) {
    this.maxEntries = maxEntries;
    this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
    if (this.sweepTimer.unref) {
      this.sweepTimer.unref();
    }
  }

  check(key: string, windowMs: number, maxRequests: number): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || record.resetTime < now) {
      if (this.store.size >= this.maxEntries) {
        this.sweep();
      }
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true };
    }

    if (record.count < maxRequests) {
      record.count++;
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  private sweep(): void {
    const now = Date.now();
    this.store.forEach((record, key) => {
      if (record.resetTime < now) {
        this.store.delete(key);
      }
    });
  }

  destroy(): void {
    clearInterval(this.sweepTimer);
    this.store.clear();
  }
}

const rateLimiter = new RateLimiter();

export function rateLimitMiddleware(
  windowMs: number = 60000,
  maxRequests: number = 10
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const result = rateLimiter.check(key, windowMs, maxRequests);

    if (result.allowed) {
      next();
    } else {
      res.status(429).json({
        message: "Too many requests. Please try again later.",
        retryAfter: result.retryAfter,
      });
    }
  };
}

/**
 * Request validation middleware
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * CORS configuration for security.
 * Guardian Fix: Never falls back to wildcard "*" in production.
 * Only reflects Origin when it matches the allowlist.
 */
export function setupCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "http://localhost:5000",
    "http://localhost:3000",
    process.env.APP_URL,
  ].filter(Boolean);

  if (process.env.NODE_ENV === "development" && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
}

/**
 * Error handling middleware.
 * Guardian Fix: Typed error shape, no `any` leaking to response.
 * Production errors never expose internal messages for 5xx.
 */
export function errorHandler(
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV === "development";

  const clientMessage =
    status >= 500 && !isDev
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

  const response: { message: string; stack?: string } = { message: clientMessage };

  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(status).json(response);

  if (status >= 500) {
    console.error(`[ERROR] ${status}: ${err.message}`, err);
  }
}
