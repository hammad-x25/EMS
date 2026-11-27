import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { AnnouncementSchema, createAnnouncement } from "@/lib/monitoring";
import { requireAuth } from "@/lib/rbac";

type Context = { params: Promise<{ id: string }> };

export const POST = apiHandler<Context>(async (request, context) => {
  const actor = await requireAuth([Role.EXAMINER]);
  const { id } = await context.params;
  const input = AnnouncementSchema.parse(await request.json());
  return NextResponse.json({ announcement: await createAnnouncement(actor, id, input.message) }, { status: 201 });
});
