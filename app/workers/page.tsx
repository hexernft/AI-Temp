"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabase";

type WorkerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  is_active: boolean;
};

type CurrentProfile = {
  id: string;
  role: string;
};

type CreateWorkerResponse = {
  success?: boolean;
  error?: string;
  worker?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active?: boolean;
  };
};

type UpdateWorkerResponse = {
  success?: boolean;
  error?: string;
  worker?: WorkerProfile;
};

type DeleteWorkerResponse = {
  success?: boolean;
  error?: string;
  deleted_worker?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
  };
};

const roleOptions = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "pastor", label: "Pastor" },
  { value: "follow_up_coordinator", label: "Follow-Up Coordinator" },
  { value: "worker", label: "Worker" },
  { value: "foundation_school_teacher", label: "Foundation School Teacher" },
  { value: "baptism_coordinator", label: "Baptism Coordinator" },
];

const allowedManagerRoles = ["super_admin", "admin", "pastor"];

function formatRole(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingActiveId, setUpdatingActiveId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "worker",
  });

  const [editingWorker, setEditingWorker] = useState<WorkerProfile | null>(
    null
  );

  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    role: "worker",
  });

  const canManageWorkers = currentProfile
    ? allowedManagerRoles.includes(currentProfile.role)
    : false;

  const loadWorkers = useCallback(async function loadWorkers() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User load error:", userError);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Current profile load error:", profileError);
    } else {
      setCurrentProfile(profileData);
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at, is_active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Workers load error:", error);
      alert(error.message || "Could not load workers.");
      setLoading(false);
      return;
    }

    setWorkers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWorkers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadWorkers]);

  function updateCreateField(name: string, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateEditField(name: string, value: string) {
    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function startEditing(worker: WorkerProfile) {
    setEditingWorker(worker);
    setEditForm({
      full_name: worker.full_name || "",
      email: worker.email || "",
      role: worker.role,
    });
  }

  function cancelEditing() {
    setEditingWorker(null);
    setEditForm({
      full_name: "",
      email: "",
      role: "worker",
    });
  }

  async function handleCreateWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageWorkers) {
      alert("You do not have permission to create workers.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setCreating(false);
        return;
      }

      const response = await fetch("/api/workers/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as CreateWorkerResponse;

      if (!response.ok || !result.success) {
        alert(result.error || "Could not create worker.");
        setCreating(false);
        return;
      }

      setForm({
        full_name: "",
        email: "",
        password: "",
        role: "worker",
      });

      await loadWorkers();

      alert("Worker created successfully.");
    } catch (error) {
      console.error("Create worker request error:", error);
      alert("Something went wrong while creating the worker.");
    }

    setCreating(false);
  }

  async function handleUpdateWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingWorker) return;

    if (!canManageWorkers) {
      alert("You do not have permission to update workers.");
      return;
    }

    setSavingEdit(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setSavingEdit(false);
        return;
      }

      const response = await fetch("/api/workers/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: editingWorker.id,
          full_name: editForm.full_name,
          email: editForm.email,
          role: editForm.role,
        }),
      });

      const result = (await response.json()) as UpdateWorkerResponse;

      if (!response.ok || !result.success || !result.worker) {
        alert(result.error || "Could not update worker.");
        setSavingEdit(false);
        return;
      }

      setWorkers((current) =>
        current.map((worker) =>
          worker.id === result.worker?.id ? result.worker : worker
        )
      );

      cancelEditing();

      alert("Worker updated successfully.");
    } catch (error) {
      console.error("Update worker request error:", error);
      alert("Something went wrong while updating the worker.");
    }

    setSavingEdit(false);
  }

  async function handleToggleActive(worker: WorkerProfile) {
    if (!canManageWorkers) {
      alert("You do not have permission to update workers.");
      return;
    }

    if (currentProfile?.id === worker.id && worker.is_active) {
      alert("You cannot deactivate your own account.");
      return;
    }

    const nextStatus = !worker.is_active;

    const confirmed = window.confirm(
      nextStatus
        ? `Activate ${worker.full_name || worker.email}?`
        : `Deactivate ${
            worker.full_name || worker.email
          }? This will stop them from logging in.`
    );

    if (!confirmed) return;

    setUpdatingActiveId(worker.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setUpdatingActiveId("");
        return;
      }

      const response = await fetch("/api/workers/toggle-active", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: worker.id,
          is_active: nextStatus,
        }),
      });

      const result = (await response.json()) as UpdateWorkerResponse;

      if (!response.ok || !result.success || !result.worker) {
        alert(result.error || "Could not update worker status.");
        setUpdatingActiveId("");
        return;
      }

      setWorkers((current) =>
        current.map((item) =>
          item.id === result.worker?.id ? result.worker : item
        )
      );

      alert(nextStatus ? "Worker activated." : "Worker deactivated.");
    } catch (error) {
      console.error("Toggle worker active request error:", error);
      alert("Something went wrong while updating worker status.");
    }

    setUpdatingActiveId("");
  }

  async function handleDeleteWorker(worker: WorkerProfile) {
    if (!canManageWorkers) {
      alert("You do not have permission to delete workers.");
      return;
    }

    if (currentProfile?.id === worker.id) {
      alert("You cannot delete your own account.");
      return;
    }

    const firstConfirm = window.confirm(
      `Delete ${
        worker.full_name || worker.email
      }? This is permanent. Deactivate is safer if you only want to block access.`
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "Are you absolutely sure? This will permanently remove the worker login and profile."
    );

    if (!secondConfirm) return;

    setDeletingId(worker.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Your session has expired. Please log in again.");
        setDeletingId("");
        return;
      }

      const response = await fetch("/api/workers/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: worker.id,
        }),
      });

      const responseText = await response.text();

      let result: DeleteWorkerResponse = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        console.error("Delete worker non-JSON response:", responseText);
        alert(
          `Delete failed. The server did not return JSON. Status: ${response.status}. Check if /api/workers/delete exists and was deployed.`
        );
        setDeletingId("");
        return;
      }

      if (!response.ok || !result.success) {
        console.error("Delete worker API error:", result);
        alert(
          result.error || `Could not delete worker. Status: ${response.status}`
        );
        setDeletingId("");
        return;
      }

      setWorkers((current) => current.filter((item) => item.id !== worker.id));

      if (editingWorker?.id === worker.id) {
        cancelEditing();
      }

      alert("Worker deleted successfully.");
    } catch (error) {
      console.error("Delete worker request error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting the worker.";

      alert(message);
    }

    setDeletingId("");
  }

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const searchValue = search.toLowerCase().trim();

      const workerName = worker.full_name || "";
      const workerEmail = worker.email || "";

      const matchesSearch =
        !searchValue ||
        workerName.toLowerCase().includes(searchValue) ||
        workerEmail.toLowerCase().includes(searchValue) ||
        worker.role.toLowerCase().includes(searchValue);

      const matchesRole = roleFilter === "all" || worker.role === roleFilter;

      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "active" && worker.is_active) ||
        (activeFilter === "inactive" && !worker.is_active);

      return matchesSearch && matchesRole && matchesActive;
    });
  }, [activeFilter, roleFilter, search, workers]);

  const activeCount = workers.filter((worker) => worker.is_active).length;
  const inactiveCount = workers.filter((worker) => !worker.is_active).length;

  const followUpCount = workers.filter(
    (worker) =>
      worker.is_active &&
      (worker.role === "worker" || worker.role === "follow_up_coordinator")
  ).length;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="grid gap-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Workers
                </p>

                <h1 className="mt-1 font-display text-[1.55rem] font-black leading-tight tracking-[-0.045em] text-slate-950">
                  Worker management
                </h1>

                <p className="mt-1 max-w-2xl text-[0.86rem] leading-5 text-slate-500">
                  Manage WelCare access, worker roles, active status, and
                  dashboard permissions.
                </p>
              </div>

              <span className="w-fit rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600">
                {canManageWorkers ? "Manager access" : "View only"}
              </span>
            </div>
          </section>

          {canManageWorkers ? (
            <form
              onSubmit={handleCreateWorker}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3">
                <h2 className="font-display text-[1rem] font-black text-slate-950">
                  Create worker
                </h2>
                <p className="mt-0.5 text-[0.78rem] text-slate-500">
                  Add a new worker account with login access.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-[1fr_1fr_0.9fr_1fr_auto] lg:items-end">
                <Field label="Full name">
                  <input
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      updateCreateField("full_name", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Mary Johnson"
                  />
                </Field>

                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateCreateField("email", event.target.value)
                    }
                    className="input-compact"
                    placeholder="worker@church.com"
                  />
                </Field>

                <Field label="Password">
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      updateCreateField("password", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Min. 6 characters"
                    minLength={6}
                  />
                </Field>

                <Field label="Role">
                  <select
                    value={form.role}
                    onChange={(event) =>
                      updateCreateField("role", event.target.value)
                    }
                    className="input-compact"
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-display text-[1rem] font-black text-slate-950">
                Worker access
              </h2>
              <p className="mt-1 text-[0.82rem] text-slate-500">
                You can view workers, but only admins, pastors, and super admins
                can create, edit, activate, deactivate, or delete accounts.
              </p>
            </section>
          )}

          {editingWorker && canManageWorkers && (
            <form
              onSubmit={handleUpdateWorker}
              className="rounded-2xl border border-slate-950 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div>
                  <h2 className="font-display text-[1rem] font-black text-slate-950">
                    Edit worker
                  </h2>
                  <p className="mt-0.5 text-[0.78rem] text-slate-500">
                    Updating{" "}
                    <span className="font-black text-slate-800">
                      {editingWorker.full_name || editingWorker.email}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelEditing}
                  className="w-fit rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600 transition hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                <Field label="Full name">
                  <input
                    required
                    value={editForm.full_name}
                    onChange={(event) =>
                      updateEditField("full_name", event.target.value)
                    }
                    className="input-compact"
                    placeholder="Worker full name"
                  />
                </Field>

                <Field label="Profile email">
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      updateEditField("email", event.target.value)
                    }
                    className="input-compact"
                    placeholder="worker@church.com"
                  />
                </Field>

                <Field label="Role">
                  <select
                    value={editForm.role}
                    onChange={(event) =>
                      updateEditField("role", event.target.value)
                    }
                    className="input-compact"
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Total workers" value={workers.length} />
            <MiniStat label="Active" value={activeCount} />
            <MiniStat label="Inactive" value={inactiveCount} />
            <MiniStat label="Follow-up team" value={followUpCount} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[1fr_200px_190px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input-compact"
                placeholder="Search name, email, or role"
              />

              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="input-compact"
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>

              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
                className="input-compact"
              >
                <option value="active">Active workers</option>
                <option value="inactive">Inactive workers</option>
                <option value="all">All workers</option>
              </select>
            </div>
          </section>

          {loading ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-500">
                Loading workers...
              </p>
            </section>
          ) : filteredWorkers.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-black text-slate-800">
                No workers found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try changing the filters or create a worker account.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.1fr_1.3fr_1fr_0.7fr_0.8fr_1.7fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 lg:grid">
                <p>Name</p>
                <p>Email</p>
                <p>Role</p>
                <p>Status</p>
                <p>Added</p>
                <p>Action</p>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 lg:grid-cols-[1.1fr_1.3fr_1fr_0.7fr_0.8fr_1.7fr] lg:items-center"
                  >
                    <div>
                      <p className="text-[0.9rem] font-black text-slate-950">
                        {worker.full_name || "Unnamed Worker"}
                      </p>
                      <p className="mt-0.5 text-[0.76rem] text-slate-500 lg:hidden">
                        {worker.email || "No email"}
                      </p>
                    </div>

                    <p className="hidden text-[0.82rem] font-semibold text-slate-600 lg:block">
                      {worker.email || "No email"}
                    </p>

                    <p className="w-fit rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                      {formatRole(worker.role)}
                    </p>

                    <p
                      className={`w-fit rounded-lg px-2 py-1 text-[10px] font-black ${
                        worker.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {worker.is_active ? "Active" : "Inactive"}
                    </p>

                    <p className="text-[0.8rem] font-medium text-slate-500">
                      {formatDate(worker.created_at)}
                    </p>

                    {canManageWorkers ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(worker)}
                          className="rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-slate-800"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(worker)}
                          disabled={updatingActiveId === worker.id}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition disabled:opacity-60 ${
                            worker.is_active
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {updatingActiveId === worker.id
                            ? "Saving..."
                            : worker.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteWorker(worker)}
                          disabled={deletingId === worker.id}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingId === worker.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[0.8rem] text-slate-400">No access</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.45rem] font-black leading-none text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[0.76rem] font-black text-slate-600">{label}</span>
      {children}
    </label>
  );
}