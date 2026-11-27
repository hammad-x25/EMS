import { AppError } from "@/lib/errors";

type Entry = { attempts: number; resetAt: number };
const entries = new Map<string, Entry>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function assertLoginRateLimit(key: string, now = Date.now()): void {
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (current.attempts >= MAX_ATTEMPTS) {
    throw new AppError("Too many login attempts. Try again later.", 429, "RATE_LIMITED", {
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    });
  }
  current.attempts += 1;
}

export function resetLoginRateLimit(key: string): void {
  entries.delete(key);
}
