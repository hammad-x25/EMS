import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { verifyPublicReport } from "@/lib/verification";

type Context = { params: Promise<{ code: string }> };

export const GET = apiHandler<Context>(async (_request, context) => {
  const { code } = await context.params;
  return NextResponse.json(await verifyPublicReport(code.toUpperCase()));
});
