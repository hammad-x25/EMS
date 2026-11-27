import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

type ApiHandler<TContext> = (request: NextRequest, context: TContext) => Promise<Response>;
type StaticRouteContext = { params: Promise<Record<string, string>> };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
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
      return await handler(request, context);
    } catch (error: unknown) {
      return errorResponse(error);
    }
  };
}
