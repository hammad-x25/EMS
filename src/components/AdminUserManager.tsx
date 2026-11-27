"use client";

import { FormEvent, useMemo, useState } from "react";
import { KeyRound, Plus, Search, UserCheck, UserX, X } from "lucide-react";
import type { UserDto } from "@/lib/user-dto";

type Role = "ADMIN" | "EXAMINER" | "CANDIDATE";
type ApiBody = { user?: UserDto; error?: { message?: string } };

const roles: Role[] = ["ADMIN", "EXAMINER", "CANDIDATE"];

async function parseResponse(response: Response): Promise<ApiBody> {
  const body = (await response.json()) as ApiBody;
  if (!response.ok) throw new Error(body.error?.message ?? "The request could not be completed");
  return body;
}

export function AdminUserManager({ initialUsers }: { initialUsers: UserDto[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return users.filter((user) =>
      (roleFilter === "ALL" || user.role === roleFilter) &&
      (statusFilter === "ALL" || user.isActive === (statusFilter === "ACTIVE")) &&
      (!normalized || `${user.name} ${user.email} ${user.studentId ?? ""}`.toLowerCase().includes(normalized)),
    );
  }, [query, roleFilter, statusFilter, users]);

  function replaceUser(updated: UserDto) {
    setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
  }

  async function updateUser(user: UserDto, patch: { role?: Role; isActive?: boolean }) {
    setBusyId(user.id);
    setMessage(null);
    try {
      const body = await parseResponse(await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }));
      if (body.user) replaceUser(body.user);
      setMessage({ type: "success", text: `${user.name} was updated.` });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Update failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyId("create");
    setMessage(null);
    try {
      const body = await parseResponse(await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), email: data.get("email"), password: data.get("password"),
          role: data.get("role"), studentId: data.get("studentId") || null,
        }),
      }));
      if (body.user) setUsers((current) => [...current, body.user as UserDto]);
      form.reset();
      setShowCreate(false);
      setMessage({ type: "success", text: "User account created." });
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Account creation failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusyId(resetTarget.id);
    setMessage(null);
    try {
      await parseResponse(await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
      }));
      setMessage({ type: "success", text: `Password reset for ${resetTarget.name}.` });
      setResetTarget(null);
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Password reset failed" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-64 flex-1"><span className="sr-only">Search users</span><Search className="absolute left-3 top-3.5 text-slate-400" size={18} /><input className="field pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or student ID" value={query} /></label>
        <select aria-label="Filter by role" className="field w-auto" onChange={(event) => setRoleFilter(event.target.value as "ALL" | Role)} value={roleFilter}><option value="ALL">All roles</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
        <select aria-label="Filter by status" className="field w-auto" onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")} value={statusFilter}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        <button className="btn-primary" onClick={() => setShowCreate((value) => !value)} type="button">{showCreate ? <X size={18} /> : <Plus size={18} />}{showCreate ? "Close" : "Create user"}</button>
      </div>

      {message ? <div aria-live="polite" className={`rounded-xl border p-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{message.text}</div> : null}

      {showCreate ? (
        <form className="card grid gap-4 p-5 md:grid-cols-2" onSubmit={createUser}>
          <div className="md:col-span-2"><h2 className="font-black">Create account</h2><p className="muted mt-1 text-sm">The assigned role is enforced by the backend immediately.</p></div>
          <label className="text-sm font-bold">Full name<input className="field mt-2" name="name" required /></label>
          <label className="text-sm font-bold">Email<input className="field mt-2" name="email" required type="email" /></label>
          <label className="text-sm font-bold">Role<select className="field mt-2" defaultValue="CANDIDATE" name="role">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label className="text-sm font-bold">Student ID <span className="font-normal text-slate-400">(optional)</span><input className="field mt-2" name="studentId" /></label>
          <label className="text-sm font-bold md:col-span-2">Temporary password<input className="field mt-2" minLength={10} name="password" required type="password" /><span className="mt-1 block text-xs font-normal text-slate-500">At least 10 characters with upper/lowercase, number, and symbol.</span></label>
          <div className="md:col-span-2"><button className="btn-primary" disabled={busyId === "create"} type="submit">{busyId === "create" ? "Creating…" : "Create account"}</button></div>
        </form>
      ) : null}

      <section className="card overflow-hidden">
        <div className="desktop-table"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Created</th><th className="p-4 text-right">Actions</th></tr></thead><tbody>
          {filtered.map((user) => (
            <tr className="border-t border-slate-100" key={user.id}>
              <td className="p-4"><p className="font-bold">{user.name}</p><p className="text-xs text-slate-500">{user.email}{user.studentId ? ` · ${user.studentId}` : ""}</p></td>
              <td className="p-4"><select aria-label={`Role for ${user.name}`} className="field min-w-36 py-2" disabled={busyId === user.id} onChange={(event) => updateUser(user, { role: event.target.value as Role })} value={user.role}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td>
              <td className="p-4"><span className={`status-pill ${user.isActive ? "status-active" : "status-inactive"}`}>{user.isActive ? <UserCheck size={13} /> : <UserX size={13} />}{user.isActive ? "Active" : "Inactive"}</span></td>
              <td className="whitespace-nowrap p-4 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
              <td className="p-4"><div className="flex justify-end gap-2"><button aria-label={`Reset password for ${user.name}`} className="btn-secondary px-3 py-2" onClick={() => setResetTarget(user)} type="button"><KeyRound size={16} /></button><button className={user.isActive ? "btn-danger px-3 py-2" : "btn-secondary px-3 py-2"} disabled={busyId === user.id} onClick={() => updateUser(user, { isActive: !user.isActive })} type="button">{user.isActive ? "Deactivate" : "Activate"}</button></div></td>
            </tr>
          ))}
        </tbody></table></div>
        {filtered.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No users match the current filters.</p> : null}
      </section>

      {resetTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <form className="card w-full max-w-md p-6" onSubmit={resetPassword}><div className="flex items-start justify-between"><div><h2 className="text-xl font-black" id="reset-title">Reset password</h2><p className="muted mt-1 text-sm">Set a temporary password for {resetTarget.name}.</p></div><button aria-label="Close password reset" className="p-1" onClick={() => setResetTarget(null)} type="button"><X /></button></div><label className="mt-5 block text-sm font-bold">New temporary password<input autoFocus className="field mt-2" minLength={10} name="password" required type="password" /></label><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setResetTarget(null)} type="button">Cancel</button><button className="btn-primary" disabled={busyId === resetTarget.id} type="submit">Reset password</button></div></form>
        </div>
      ) : null}
    </div>
  );
}
