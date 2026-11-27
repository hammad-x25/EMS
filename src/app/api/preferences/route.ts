import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import {
  getWorkspacePreferences,
  updateWorkspacePreferences,
  WorkspacePreferencesPatchSchema,
} from "@/lib/preferences";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async () => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER]);
  return NextResponse.json({ preferences: await getWorkspacePreferences(actor.userId) });
});

export const PATCH = apiHandler(async (request) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER]);
  const patch = WorkspacePreferencesPatchSchema.parse(await request.json());
  return NextResponse.json({
    preferences: await updateWorkspacePreferences(actor.userId, patch),
  });
});
