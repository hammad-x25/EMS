import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { apiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";

const routeContext = { params: Promise.resolve({}) };

describe("API CSRF, content-type, malformed JSON, and rate-limit headers", () => {
  it("rejects text/plain mutations with 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    const wrapped = apiHandler(async () => NextResponse.json({ ok: true }));
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    const res = await wrapped(req, routeContext);
    expect(res.status).toBe(415);
  });

  it("rejects cross-origin POST requests with 403 FORBIDDEN", async () => {
    const wrapped = apiHandler(async () => NextResponse.json({ ok: true }));
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: "{}",
    });
    const res = await wrapped(req, routeContext);
    expect(res.status).toBe(403);
  });

  it("maps malformed JSON SyntaxError to 400 INVALID_JSON", async () => {
    const wrapped = apiHandler(async (request) => {
      await request.json();
      return NextResponse.json({ ok: true });
    });
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad-json",
    });
    const res = await wrapped(req, routeContext);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_JSON");
  });

  it("emits Retry-After headers on 429 RATE_LIMITED responses", async () => {
    const wrapped = apiHandler(async () => {
      throw new AppError("Slow down", 429, "RATE_LIMITED", {
        retryAfterSeconds: 42,
        limit: 5,
        resetAt: 999999,
      });
    });
    const req = new NextRequest("http://localhost:3000/api/auth/login", { method: "GET" });
    const res = await wrapped(req, routeContext);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(res.headers.get("x-ratelimit-limit")).toBe("5");
  });
});
