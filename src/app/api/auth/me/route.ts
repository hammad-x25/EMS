import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async () => {
  const session = await requireAuth();
  return NextResponse.json({ user: session });
});
