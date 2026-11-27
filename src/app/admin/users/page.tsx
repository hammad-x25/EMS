import { AdminUserManager } from "@/components/AdminUserManager";
import { db } from "@/lib/db";
import { toUserDto } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  return (
    <div className="space-y-8">
      <header><p className="eyebrow">Identity and access</p><h1 className="mt-2 text-3xl font-black">Users and roles</h1><p className="muted mt-2">Create accounts, assign fixed platform roles, deactivate access, and reset passwords.</p></header>
      <AdminUserManager initialUsers={users.map(toUserDto)} />
    </div>
  );
}
