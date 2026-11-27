import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { changeOwnPassword } from "@/lib/password-change";
import { extractClientIp } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/rbac";
import { ChangePasswordSchema } from "@/lib/validation";

export const POST = apiHandler(async (request) => {
  const session = await requireAuth();
  const input = ChangePasswordSchema.parse(await request.json());
  const ip = extractClientIp(request.headers);

  await changeOwnPassword(session, input, ip);
  return NextResponse.json({ ok: true });
});
