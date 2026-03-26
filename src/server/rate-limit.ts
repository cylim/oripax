/**
 * Simple sliding-window rate limiter using in-memory Map.
 *
 * Limitations:
 * - Resets when the Worker isolate is recycled (acceptable for demo/hackathon).
 * - Per-isolate, not globally distributed. For production, use Durable Objects or KV.
 */

interface WindowEntry {
  timestamps: number[]
}

const windows = new Map<string, WindowEntry>()

// Cleanup stale entries periodically to prevent memory leaks
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60_000 // 1 minute

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) windows.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g., IP address, wallet address, or "ip:endpoint")
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  cleanup(windowMs)

  const now = Date.now()
  const cutoff = now - windowMs

  let entry = windows.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    windows.set(key, entry)
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]!
    const retryAfterMs = oldestInWindow + windowMs - now
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  }
}

/**
 * Extract a client identifier from the request for rate limiting.
 * Uses CF-Connecting-IP (Cloudflare), X-Forwarded-For, or falls back to a generic key.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * Build a rate-limit Response (429 Too Many Requests).
 */
export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000)
  return new Response(
    JSON.stringify({ error: 'Too many requests, please try again later' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSec),
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
