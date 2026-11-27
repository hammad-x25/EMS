import { DisputeStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createDispute, CreateDisputeSchema, listDisputes } from "@/lib/disputes";
import { requireAuth } from "@/lib/rbac";

export const GET = apiHandler(async (request) => {
  const actor = await requireAuth([Role.CANDIDATE, Role.EXAMINER, Role.ADMIN]);
  const params = request.nextUrl.searchParams;
  const attemptId = params.get("attemptId")?.trim() || undefined;
  const examId = params.get("examId")?.trim() || undefined;
  const statusParam = params.get("status")?.trim();
  const status = Object.values(DisputeStatus).includes(statusParam as DisputeStatus)
    ? (statusParam as DisputeStatus)
    : undefined;

  const disputes = await listDisputes(actor, { attemptId, examId, status });
  return NextResponse.json({ disputes });
});

export const POST = apiHandler(async (request) => {
  const actor = await requireAuth([Role.CANDIDATE]);
  const input = CreateDisputeSchema.parse(await request.json());
  const dispute = await createDispute(actor, input);
  return NextResponse.json({ dispute }, { status: 201 });
});
