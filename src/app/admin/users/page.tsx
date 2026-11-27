import { AdminUserManager } from "@/components/AdminUserManager";
import { db } from "@/lib/db";
import { toUserDto } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

const INITIAL_LIMIT = 20;

export default async function UsersPage() {
  const [totalUsers, users] = await db.$transaction([
    db.user.count(),
    db.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: INITIAL_LIMIT,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Identity and access</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-3xl">
          Users and roles
        </h1>
        <p className="muted mt-1 text-sm">
          Create accounts, confirm role changes, manage account status, and reset temporary passwords.
        </p>
      </header>
      <AdminUserManager
        initialLimit={INITIAL_LIMIT}
        initialTotal={totalUsers}
        initialUsers={users.map(toUserDto)}
      />
    </div>
  );
}
