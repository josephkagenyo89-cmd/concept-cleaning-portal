/**
 * Client-side rate limiter (UX protection only; real limits are enforced by Supabase).
 * peek() looks without counting. hit() records one attempt.
 * State lives in localStorage so a page refresh doesn't reset it.
 */

interface RateLimitRecord {
  attempts: number[];
  blockedUntil?: number;
}

export interface RateStatus {
  allowed: boolean;
  remaining: number;
  secondsRemaining: number;
}

const STORE_KEY = 'cc_rate_limits_v1';

class ClientRateLimiter {
  private load(): Record<string, RateLimitRecord> {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  private save(data: Record<string, RateLimitRecord>) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable: fail open */
    }
  }

  private evaluate(rec: RateLimitRecord, max: number, windowMs: number, now: number): RateStatus {
    if (rec.blockedUntil && now >= rec.blockedUntil) {
      rec.blockedUntil = undefined;
      rec.attempts = [];
    }
    rec.attempts = rec.attempts.filter((t) => now - t < windowMs);

    if (rec.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        secondsRemaining: Math.ceil((rec.blockedUntil - now) / 1000),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, max - rec.attempts.length),
      secondsRemaining: 0,
    };
  }

  /** Look only. Does NOT count as an attempt. */
  peek(key: string, max: number, windowMs: number): RateStatus {
    const data = this.load();
    const rec = data[key] || { attempts: [] };
    const status = this.evaluate(rec, max, windowMs, Date.now());
    data[key] = rec;
    this.save(data);
    return status;
  }

  /** Record one attempt; blocks once max is reached. */
  hit(key: string, max: number, windowMs: number): RateStatus {
    const now = Date.now();
    const data = this.load();
    const rec = data[key] || { attempts: [] };
    this.evaluate(rec, max, windowMs, now);
    rec.attempts.push(now);
    if (rec.attempts.length >= max) rec.blockedUntil = now + windowMs;
    data[key] = rec;
    this.save(data);
    return this.evaluate(rec, max, windowMs, now);
  }

  clear(key: string) {
    const data = this.load();
    delete data[key];
    this.save(data);
  }
}

export const rateLimiter = new ClientRateLimiter();

export const RATE_LIMIT_CONFIG = {
  LOGIN: { key: 'login_attempts', maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  PASSWORD_RESET: { key: 'password_reset', maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  SIGNUP: { key: 'signup_attempts', maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  API_GENERAL: { key: 'api_general', maxAttempts: 100, windowMs: 60 * 1000 },
  CREATE_BOOKING: { key: 'create_booking', maxAttempts: 10, windowMs: 60 * 1000 },
  SEND_MESSAGE: { key: 'send_message', maxAttempts: 20, windowMs: 60 * 1000 },
};
