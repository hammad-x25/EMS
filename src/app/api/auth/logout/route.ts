import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export const POST = apiHandler(async () => {
  const session = await getSession();
  if (session) {
    await db.user.update({
      where: { id: session.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await writeAudit({ actorId: session.userId, action: "LOGOUT", entityType: "User", entityId: session.userId });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
