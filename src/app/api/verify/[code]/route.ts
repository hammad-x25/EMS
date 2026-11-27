import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { assertRateLimit, extractClientIp } from "@/lib/rate-limit";
import { verifyPublicReport } from "@/lib/verification";

type Context = { params: Promise<{ code: string }> };

export const GET = apiHandler<Context>(async (request, context) => {
  assertRateLimit(`verify:${extractClientIp(request.headers)}`, {
    maxAttempts: 30,
    windowMs: 60_000,
    message: "Too many verification requests. Please wait a minute and retry.",
  });
  const { code } = await context.params;
  return NextResponse.json(await verifyPublicReport(code.toUpperCase()));
});
