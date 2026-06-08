/**
 * MonsterWebMCP - Per-Tool Rate Limiter
 * Token bucket algorithm with configurable per-tool limits
 */

import type { RateLimitConfig } from '../core/types';

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private defaultConfig: RateLimitConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(defaultConfig?: RateLimitConfig) {
    this.defaultConfig = defaultConfig ?? { maxRequests: 100, windowMs: 60000 };
    // Periodically clean up stale buckets to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // every 5 minutes
  }

  /**
   * Configure rate limit for a specific tool
   */
  setLimit(toolName: string, config: RateLimitConfig): void {
    this.configs.set(toolName, config);
  }

  /**
   * Remove rate limit configuration for a tool
   */
  removeLimit(toolName: string): void {
    this.configs.delete(toolName);
    this.buckets.delete(toolName);
  }

  /**
   * Check if a request is allowed for the given tool
   * Returns true if the request is allowed, false if rate limited
   */
  check(toolName: string): boolean {
    const config = this.configs.get(toolName) ?? this.defaultConfig;
    const now = Date.now();
    let bucket = this.buckets.get(toolName);

    if (!bucket) {
      // Initialize bucket with full tokens
      bucket = {
        tokens: config.maxRequests - 1, // consume one token for this request
        lastRefill: now,
      };
      this.buckets.set(toolName, bucket);
      return true;
    }

    // Calculate token refill since last request
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((elapsed / config.windowMs) * config.maxRequests);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if we have a token available
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get the remaining requests allowed for a tool in the current window
   */
  getRemaining(toolName: string): number {
    const config = this.configs.get(toolName) ?? this.defaultConfig;
    const bucket = this.buckets.get(toolName);
    if (!bucket) return config.maxRequests;

    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((elapsed / config.windowMs) * config.maxRequests);
    return Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
  }

  /**
   * Get the time until the next token is available (in ms)
   */
  getWaitTime(toolName: string): number {
    const config = this.configs.get(toolName) ?? this.defaultConfig;
    const bucket = this.buckets.get(toolName);
    if (!bucket || bucket.tokens > 0) return 0;

    const msPerToken = config.windowMs / config.maxRequests;
    const elapsed = Date.now() - bucket.lastRefill;
    const remainder = msPerToken - (elapsed % msPerToken);
    return Math.ceil(remainder);
  }

  /**
   * Reset the rate limiter for a specific tool or all tools
   */
  reset(toolName?: string): void {
    if (toolName) {
      this.buckets.delete(toolName);
    } else {
      this.buckets.clear();
    }
  }

  /**
   * Clean up stale buckets that haven't been used recently
   */
  private cleanup(): void {
    const now = Date.now();
    const staleThreshold = 3600000; // 1 hour

    for (const [toolName, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(toolName);
      }
    }
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
    this.configs.clear();
  }
}
