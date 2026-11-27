"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Plus, Users } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTableToolbar, PaginationControls } from "@/components/ui/DataTableControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parseApiError, readApiJson } from "@/lib/form-errors";
import type { PaginationMeta } from "@/lib/pagination";
import type { UserDto } from "@/lib/user-dto";

type Role = "ADMIN" | "EXAMINER" | "CANDIDATE";

interface UsersListResponse {
  users?: UserDto[];
  pagination?: PaginationMeta;
  error?: { message?: string; details?: unknown };
}

interface MutationResponse {
  user?: UserDto;
  error?: { message?: string; details?: unknown };
}

const roles: Role[] = ["ADMIN", "EXAMINER", "CANDIDATE"];

export function AdminUserManager({
  initialUsers,
  initialTotal,
  initialLimit = 20,
}: {
  initialUsers: UserDto[];
  initialTotal: number;
  initialLimit?: number;
}) {
  const [users, setUsers] = useState<UserDto[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [loadingList, setLoadingList] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);
  const [pendingStatusTarget, setPendingStatusTarget] = useState<{
    user: UserDto;
    nextActive: boolean;
  } | null>(null);
  const [pendingRoleTarget, setPendingRoleTarget] = useState<{
    user: UserDto;
    nextRole: Role;
  } | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const didMountRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const fetchPage = useCallback(
    async (targetPage: number, targetLimit: number, searchText: string, role: "ALL" | Role, status: "ALL" | "ACTIVE" | "INACTIVE") => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(targetLimit),
        });
        if (searchText) params.set("search", searchText);
        if (role !== "ALL") params.set("role", role);
        if (status !== "ALL") params.set("status", status.toLowerCase());

        const response = await fetch(`/api/admin/users?${params.toString()}`);
        const body = await readApiJson<UsersListResponse>(response);
        if (!response.ok || !body?.users) {
          throw new Error(parseApiError(body, "Unable to load users").message);
        }
        setUsers(body.users);
        setTotal(body.pagination?.total ?? body.users.length);
      } catch (err: unknown) {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Unable to load users",
        });
      } finally {
        setLoadingList(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void fetchPage(page, limit, debouncedQuery, roleFilter, statusFilter);
  }, [page, limit, debouncedQuery, roleFilter, statusFilter, fetchPage]);

  async function confirmUserPatch(user: UserDto, patch: { role?: Role; isActive?: boolean }, successText: string) {
    setBusyId(user.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await readApiJson<MutationResponse>(response);
      if (!response.ok || !body?.user) {
        throw new Error(parseApiError(body, "Update failed").message);
      }
      setMessage({ type: "success", text: successText });
      await fetchPage(page, limit, debouncedQuery, roleFilter, statusFilter);
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Update failed" });
    } finally {
      setBusyId(null);
      setPendingStatusTarget(null);
      setPendingRoleTarget(null);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyId("create");
    setCreateErrors({});
    setCreateFormError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role"),
          studentId: data.get("studentId") || null,
        }),
      });
      const body = await readApiJson<MutationResponse>(response);
      if (!response.ok || !body?.user) {
        const parsed = parseApiError(body, "Account creation failed");
        setCreateErrors(parsed.fieldErrors);
        setCreateFormError(parsed.formErrors[0] ?? parsed.message);
        return;
      }
      form.reset();
      setShowCreate(false);
      setShowCreatePassword(false);
      setMessage({ type: "success", text: `Account created for ${body.user.name}.` });
      await fetchPage(1, limit, debouncedQuery, roleFilter, statusFilter);
      setPage(1);
    } catch (error: unknown) {
      setCreateFormError(error instanceof Error ? error.message : "Account creation failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusyId(resetTarget.id);
    setResetError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await readApiJson<MutationResponse>(response);
      if (!response.ok) {
        const parsed = parseApiError(body, "Password reset failed");
        setResetError(parsed.fieldErrors.password ?? parsed.message);
        return;
      }
      setMessage({ type: "success", text: `Temporary password reset for ${resetTarget.name}.` });
      setResetTarget(null);
      setShowResetPassword(false);
    } catch (error: unknown) {
      setResetError(error instanceof Error ? error.message : "Password reset failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <DataTableToolbar
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setCreateErrors({});
              setCreateFormError(null);
              setShowCreate(true);
            }}
            type="button"
          >
            <Plus size={16} /> Create user
          </button>
        }
        filters={
          <>
            <select
              aria-label="Filter by role"
              className="field w-auto min-w-36"
              onChange={(event) => {
                setRoleFilter(event.target.value as "ALL" | Role);
                setPage(1);
              }}
              value={roleFilter}
            >
              <option value="ALL">All roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              className="field w-auto min-w-36"
              onChange={(event) => {
                setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE");
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </>
        }
        onSearchChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        search={query}
        searchLabel="Search users"
        searchPlaceholder="Search name, email, or student ID"
      />

      {message ? (
        <AlertBanner onDismiss={() => setMessage(null)} variant={message.type}>
          {message.text}
        </AlertBanner>
      ) : null}

      <section className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState
            description={
              loadingList
                ? "Loading matching user accounts…"
                : "Adjust your search query or filters to view accounts."
            }
            icon={Users}
            title={loadingList ? "Loading accounts" : "No matching accounts"}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-surface-subtle)] text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Created</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr className="border-t border-[var(--border-subtle)]" key={user.id}>
                      <td className="p-4">
                        <p className="font-semibold text-[var(--text-primary)]">{user.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {user.email}
                          {user.studentId ? ` · ${user.studentId}` : ""}
                        </p>
                      </td>
                      <td className="p-4">
                        <select
                          aria-label={`Role for ${user.name}`}
                          className="field min-w-36 py-1.5"
                          disabled={busyId === user.id}
                          onChange={(event) => {
                            const nextRole = event.target.value as Role;
                            if (nextRole !== user.role) {
                              setPendingRoleTarget({ user, nextRole });
                            }
                          }}
                          value={user.role}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td className="font-mono-tabular whitespace-nowrap p-4 text-xs text-[var(--text-secondary)]">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label={`Reset password for ${user.name}`}
                            className="btn-secondary h-9 px-3 text-xs"
                            onClick={() => {
                              setResetError(null);
                              setResetTarget(user);
                            }}
                            type="button"
                          >
                            <KeyRound size={15} /> Reset
                          </button>
                          <button
                            className={user.isActive ? "btn-danger h-9 px-3 text-xs" : "btn-secondary h-9 px-3 text-xs"}
                            disabled={busyId === user.id}
                            onClick={() =>
                              setPendingStatusTarget({ user, nextActive: !user.isActive })
                            }
                            type="button"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] md:hidden">
              {users.map((user) => (
                <article className="space-y-3 p-4" key={user.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)]">{user.name}</p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                      {user.studentId ? (
                        <p className="font-mono-tabular text-xs text-[var(--text-muted)]">{user.studentId}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select
                      aria-label={`Role for ${user.name}`}
                      className="field py-1.5"
                      disabled={busyId === user.id}
                      onChange={(event) => {
                        const nextRole = event.target.value as Role;
                        if (nextRole !== user.role) {
                          setPendingRoleTarget({ user, nextRole });
                        }
                      }}
                      value={user.role}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-secondary h-9 text-xs"
                      onClick={() => {
                        setResetError(null);
                        setResetTarget(user);
                      }}
                      type="button"
                    >
                      <KeyRound size={14} /> Reset password
                    </button>
                    <button
                      className={user.isActive ? "btn-danger h-9 text-xs" : "btn-secondary h-9 text-xs"}
                      disabled={busyId === user.id}
                      onClick={() => setPendingStatusTarget({ user, nextActive: !user.isActive })}
                      type="button"
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <PaginationControls
          limit={limit}
          loading={loadingList}
          onLimitChange={(nextLimit) => {
            setLimit(nextLimit);
            setPage(1);
          }}
          onPageChange={(nextPage) => setPage(nextPage)}
          page={page}
          total={total}
        />
      </section>

      <Modal
        closeDisabled={busyId === "create"}
        description="The assigned role and active state are enforced by the backend immediately."
        eyebrow="Account provisioning"
        onClose={() => setShowCreate(false)}
        open={showCreate}
        size="lg"
        title="Create account"
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={createUser}>
          {createFormError ? (
            <div className="md:col-span-2">
              <AlertBanner variant="error">{createFormError}</AlertBanner>
            </div>
          ) : null}

          <FormField error={createErrors.name} label="Full name" required>
            <input aria-invalid={Boolean(createErrors.name)} className="field" name="name" required />
          </FormField>

          <FormField error={createErrors.email} label="Email address" required>
            <input aria-invalid={Boolean(createErrors.email)} className="field" name="email" required type="email" />
          </FormField>

          <FormField error={createErrors.role} label="Role" required>
            <select aria-invalid={Boolean(createErrors.role)} className="field" defaultValue="CANDIDATE" name="role">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </FormField>

          <FormField error={createErrors.studentId} hint="Optional institutional identifier" label="Student ID">
            <input aria-invalid={Boolean(createErrors.studentId)} className="field" name="studentId" />
          </FormField>

          <FormField
            className="md:col-span-2"
            error={createErrors.password}
            hint="At least 12 characters with upper/lowercase, number, and symbol."
            label="Temporary password"
            required
          >
            <div className="relative">
              <input
                aria-invalid={Boolean(createErrors.password)}
                className="field pr-10"
                minLength={12}
                name="password"
                required
                type={showCreatePassword ? "text" : "password"}
              />
              <button
                aria-label={showCreatePassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                onClick={() => setShowCreatePassword((v) => !v)}
                type="button"
              >
                {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4 md:col-span-2">
            <button className="btn-secondary" disabled={busyId === "create"} onClick={() => setShowCreate(false)} type="button">
              Cancel
            </button>
            <button className="btn-primary" disabled={busyId === "create"} type="submit">
              {busyId === "create" ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        closeDisabled={Boolean(resetTarget && busyId === resetTarget.id)}
        description={resetTarget ? `Set a temporary password for ${resetTarget.name} (${resetTarget.email}).` : undefined}
        eyebrow="Credential recovery"
        onClose={() => {
          setResetTarget(null);
          setResetError(null);
        }}
        open={Boolean(resetTarget)}
        size="sm"
        title="Reset password"
      >
        {resetTarget ? (
          <form className="space-y-4" onSubmit={resetPassword}>
            <FormField
              error={resetError ?? undefined}
              hint="Minimum 12 characters including uppercase, lowercase, number, and symbol. Active sessions will be revoked."
              label="New temporary password"
              required
            >
              <div className="relative">
                <input
                  aria-invalid={Boolean(resetError)}
                  className="field pr-10"
                  minLength={12}
                  name="password"
                  required
                  type={showResetPassword ? "text" : "password"}
                />
                <button
                  aria-label={showResetPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)]"
                  onClick={() => setShowResetPassword((v) => !v)}
                  type="button"
                >
                  {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>
            <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
              <button className="btn-secondary" disabled={busyId === resetTarget.id} onClick={() => setResetTarget(null)} type="button">
                Cancel
              </button>
              <button className="btn-primary" disabled={busyId === resetTarget.id} type="submit">
                {busyId === resetTarget.id ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        busy={Boolean(pendingStatusTarget && busyId === pendingStatusTarget.user.id)}
        confirmLabel={pendingStatusTarget?.nextActive ? "Activate account" : "Deactivate account"}
        consequence={
          pendingStatusTarget?.nextActive
            ? "This account will regain portal access according to its assigned role."
            : "Existing sessions will be revoked immediately and the user will be blocked from signing in."
        }
        description={
          pendingStatusTarget
            ? `Are you sure you want to ${pendingStatusTarget.nextActive ? "activate" : "deactivate"} ${pendingStatusTarget.user.name} (${pendingStatusTarget.user.email})?`
            : ""
        }
        onClose={() => setPendingStatusTarget(null)}
        onConfirm={() => {
          if (pendingStatusTarget) {
            void confirmUserPatch(
              pendingStatusTarget.user,
              { isActive: pendingStatusTarget.nextActive },
              `${pendingStatusTarget.user.name} was ${pendingStatusTarget.nextActive ? "activated" : "deactivated"}.`,
            );
          }
        }}
        open={Boolean(pendingStatusTarget)}
        title={pendingStatusTarget?.nextActive ? "Activate user account" : "Deactivate user account"}
        variant={pendingStatusTarget?.nextActive ? "default" : "danger"}
      />

      <ConfirmDialog
        busy={Boolean(pendingRoleTarget && busyId === pendingRoleTarget.user.id)}
        confirmLabel="Confirm role change"
        consequence="Changing roles immediately revokes active sessions and alters platform permissions."
        description={
          pendingRoleTarget
            ? `Change ${pendingRoleTarget.user.name}'s role from ${pendingRoleTarget.user.role} to ${pendingRoleTarget.nextRole}?`
            : ""
        }
        onClose={() => setPendingRoleTarget(null)}
        onConfirm={() => {
          if (pendingRoleTarget) {
            void confirmUserPatch(
              pendingRoleTarget.user,
              { role: pendingRoleTarget.nextRole },
              `${pendingRoleTarget.user.name}'s role was updated to ${pendingRoleTarget.nextRole}.`,
            );
          }
        }}
        open={Boolean(pendingRoleTarget)}
        title="Confirm role assignment"
        variant={pendingRoleTarget?.nextRole === "ADMIN" ? "danger" : "default"}
      />
    </div>
  );
}
