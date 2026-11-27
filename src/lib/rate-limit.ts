import { AppError } from "@/lib/errors";

type Entry = { attempts: number; resetAt: number };
const entries = new Map<string, Entry>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_IP_ATTEMPTS = 25;
const MAX_ENTRIES = 10_000;

function pruneEntries(now: number): void {
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) {
      entries.delete(key);
    }
  }
  while (entries.size >= MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey === undefined) break;
    entries.delete(oldestKey);
  }
}

export function extractClientIp(headers: Pick<Headers, "get">): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }
  return headers.get("x-real-ip")?.trim() || "direct";
}

export function assertRateLimit(
  key: string,
  options: { maxAttempts: number; windowMs: number; message?: string },
  now = Date.now(),
): void {
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    if (!current && entries.size >= MAX_ENTRIES) {
      pruneEntries(now);
    }
    entries.set(key, { attempts: 1, resetAt: now + options.windowMs });
    return;
  }
  if (current.attempts >= options.maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new AppError(
      options.message ?? "Too many requests. Please try again later.",
      429,
      "RATE_LIMITED",
      {
        retryAfterSeconds,
        limit: options.maxAttempts,
        remaining: 0,
        resetAt: Math.ceil(current.resetAt / 1000),
      },
    );
  }
  current.attempts += 1;
}

export function assertLoginRateLimit(key: string, now = Date.now()): void {
  assertRateLimit(
    key,
    {
      maxAttempts: MAX_ATTEMPTS,
      windowMs: WINDOW_MS,
      message: "Too many login attempts. Try again later.",
    },
    now,
  );
}

export function assertLoginLimits(email: string, clientIp: string, now = Date.now()): void {
  assertLoginRateLimit(`login:email:${email}`, now);
  assertRateLimit(
    `login:ip:${clientIp}`,
    {
      maxAttempts: MAX_IP_ATTEMPTS,
      windowMs: WINDOW_MS,
      message: "Too many login attempts from this network. Try again later.",
    },
    now,
  );
}

export function resetLoginRateLimit(key: string): void {
  entries.delete(key);
}

export function resetLoginLimits(email: string): void {
  entries.delete(`login:email:${email}`);
}

export function clearRateLimitStoreForTests(): void {
  entries.clear();
}
