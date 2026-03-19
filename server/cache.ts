/**
 * Self-cleaning in-memory cache with TTL (Time To Live)
 * Guardian Fix: Periodic eviction prevents unbounded memory growth.
 * Expired entries are swept every `sweepIntervalMs` instead of only on read.
 */
export class Cache<T> {
  private store = new Map<string, { data: T; expiresAt: number }>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly maxEntries: number;

  constructor(maxEntries = 1000, sweepIntervalMs = 60_000) {
    this.maxEntries = maxEntries;
    this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
    if (this.sweepTimer.unref) {
      this.sweepTimer.unref();
    }
  }

  /**
   * Set a value in cache with TTL in milliseconds (default 5 minutes).
   * Enforces a hard cap on total entries to prevent unbounded growth.
   */
  set(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.sweep();
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) {
          this.store.delete(oldestKey);
        }
      }
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Get a value from cache if not expired
   */
  get(key: string): T | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return item.data;
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove all expired entries (periodic sweep)
   */
  private sweep(): void {
    const now = Date.now();
    this.store.forEach((item, key) => {
      if (now > item.expiresAt) {
        this.store.delete(key);
      }
    });
  }

  /**
   * Stop the background sweep timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.store.clear();
  }

  /**
   * Get cache statistics (useful for debugging)
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// Global cache instances
export const leaguesCache = new Cache();
export const teamsCache = new Cache();
export const standingsCache = new Cache();
