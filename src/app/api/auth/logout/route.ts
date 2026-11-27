import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const POST = apiHandler(async () => {
  const session = await getSession();
  if (session) await writeAudit({ actorId: session.userId, action: "LOGOUT", entityType: "User", entityId: session.userId });
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
