/**
 * Rate limiting utilities
 *
 * For production, integrate with:
 * - Upstash Redis (@upstash/redis and @upstash/ratelimit)
 * - Cloudflare KV
 *
 * For now, provides interfaces for implementation
 */

export interface RateLimitConfig {
  window: number // Time window in milliseconds
  limit: number // Number of requests allowed
  key: string // Key to identify the client (IP, user ID, etc.)
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
  retryAfter?: number
}

/**
 * In-memory rate limiter for development/testing
 * Replace with Upstash or Cloudflare KV for production
 */
class InMemoryRateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map()

  check(config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const entry = this.store.get(config.key)

    // Clean up expired entries
    if (entry && entry.resetTime < now) {
      this.store.delete(config.key)
    }

    const current = this.store.get(config.key) || {
      count: 0,
      resetTime: now + config.window,
    }

    if (current.count >= config.limit) {
      return {
        success: false,
        remaining: 0,
        reset: current.resetTime,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      }
    }

    current.count++
    this.store.set(config.key, current)

    return {
      success: true,
      remaining: config.limit - current.count,
      reset: current.resetTime,
    }
  }

  reset(key: string) {
    this.store.delete(key)
  }
}

export const inMemoryLimiter = new InMemoryRateLimiter()

/**
 * Rate limit definitions for different API endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints
  auth: {
    window: 15 * 60 * 1000, // 15 minutes
    limit: 10, // 10 requests per 15 minutes
  },

  // Checkout endpoints
  checkout: {
    window: 60 * 1000, // 1 minute
    limit: 20, // 20 requests per minute
  },

  // Campaign API endpoints
  campaigns: {
    window: 60 * 1000, // 1 minute
    limit: 100, // 100 requests per minute
  },

  // General API endpoints
  api: {
    window: 60 * 1000, // 1 minute
    limit: 60, // 60 requests per minute
  },

  // Webhook endpoints
  webhooks: {
    window: 60 * 1000, // 1 minute
    limit: 100, // 100 requests per minute
  },

  // Public tracking endpoints
  tracking: {
    window: 60 * 60 * 1000, // 1 hour
    limit: 1000, // 1000 requests per hour per IP
  },
}

/**
 * Check rate limit and return response headers
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; headers: Record<string, string> } {
  const result = inMemoryLimiter.check(config)

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.reset / 1000).toString(),
  }

  if (!result.success) {
    headers['Retry-After'] = (result.retryAfter || 60).toString()
  }

  return {
    allowed: result.success,
    headers,
  }
}

/**
 * Reset rate limit for a key (useful for testing)
 */
export function resetRateLimit(key: string) {
  inMemoryLimiter.reset(key)
}
