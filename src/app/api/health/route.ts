import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const startedAt = Date.now();
  await db.$queryRaw`SELECT 1`;
  return NextResponse.json({
    status: "ok",
    services: { application: "ok", database: "ok" },
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});
