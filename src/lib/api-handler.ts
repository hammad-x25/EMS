import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ForbiddenError } from "@/lib/errors";

type ApiHandler<TContext> = (request: NextRequest, context: TContext) => Promise<Response>;
type StaticRouteContext = { params: Promise<Record<string, string>> };

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function assertSameOriginAndContentType(request: NextRequest): void {
  if (!MUTATING_METHODS.has(request.method)) return;

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    throw new ForbiddenError("Cross-site mutation requests are rejected");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const allowedOrigins = new Set<string>([request.nextUrl.origin]);
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
    if (configuredOrigin) {
      try {
        allowedOrigins.add(new URL(configuredOrigin).origin);
      } catch {
        // Ignore malformed optional origin config
      }
    }
    if (!allowedOrigins.has(origin)) {
      throw new ForbiddenError("Cross-origin mutation requests are rejected");
    }
  }

  const contentType = request.headers.get("content-type")?.trim().toLowerCase();
  if (contentType && !contentType.startsWith("application/json")) {
    throw new AppError(
      "Unsupported Content-Type; expected application/json",
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    );
  }
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if (error.status === 429 && error.details && typeof error.details === "object") {
      const details = error.details as Record<string, unknown>;
      if (typeof details.retryAfterSeconds === "number") {
        headers["Retry-After"] = String(details.retryAfterSeconds);
      }
      if (typeof details.limit === "number") {
        headers["X-RateLimit-Limit"] = String(details.limit);
        headers["X-RateLimit-Remaining"] = "0";
      }
      if (typeof details.resetAt === "number") {
        headers["X-RateLimit-Reset"] = String(details.resetAt);
      }
    }
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Malformed JSON request body" } },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The submitted data is invalid",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      { error: { code: "DUPLICATE_VALUE", message: "A record with that unique value already exists" } },
      { status: 409 },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } },
    { status: 500 },
  );
}

export function apiHandler<TContext = StaticRouteContext>(handler: ApiHandler<TContext>) {
  return async (request: NextRequest, context: TContext): Promise<Response> => {
    try {
      assertSameOriginAndContentType(request);
      return await handler(request, context);
    } catch (error: unknown) {
      return errorResponse(error);
    }
  };
}
