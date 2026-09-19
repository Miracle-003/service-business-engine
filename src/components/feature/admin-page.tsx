"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";
import { apiClient, ApiClientError } from "@/src/lib/api-client";

type Role = { id: string; name: string; description?: string | null };
type Permission = { id: string; key: string; description?: string | null };
type ListResponse<T> = { data: T[]; meta?: { total: number } };

export function AdminPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);
  const load = useCallback(async () => {
    setState("loading");
    try {
      const [roleResponse, permissionResponse] = await Promise.all([apiClient.get<ListResponse<Role>>("/roles?page=1&pageSize=100"), apiClient.get<ListResponse<Permission>>("/permissions?page=1&pageSize=100")]);
      setRoles(roleResponse.data);
      setPermissions(permissionResponse.data);
      setState(roleResponse.data.length || permissionResponse.data.length ? "ready" : "empty");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load access control data"));
      setState("error");
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return <div className="mx-auto max-w-7xl"><PageHeader eyebrow="Platform access" title="Administration" description="Review the roles and permissions returned by the existing platform access contract." />{state === "loading" ? <div className="mt-8"><LoadingState label="Loading access control" /></div> : null}{state === "error" ? <div className="mt-8"><ErrorState description={error instanceof ApiClientError && error.status === 403 ? "Your current account does not have access to platform administration." : error?.message ?? "Unable to load access control data"} onRetry={load} /></div> : null}{state === "empty" ? <div className="mt-8"><EmptyState title="No access-control records yet" description="Roles and permissions returned by the platform will appear here." /></div> : null}{state === "ready" ? <div className="mt-8 grid gap-5 lg:grid-cols-2"><GlassCard className="p-6"><h2 className="text-lg font-semibold text-white">Roles</h2><div className="mt-5 space-y-3">{roles.map((role) => <div key={role.id} className="rounded-2xl border border-white/8 bg-white/3 p-4"><p className="font-medium text-white">{role.name}</p><p className="mt-1 text-sm text-slate-400">{role.description || "No description"}</p></div>)}</div></GlassCard><GlassCard className="p-6"><h2 className="text-lg font-semibold text-white">Permissions</h2><div className="mt-5 space-y-2">{permissions.map((permission) => <div key={permission.id} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3"><p className="font-mono text-xs text-indigo-200">{permission.key}</p>{permission.description ? <p className="mt-1 text-xs text-slate-500">{permission.description}</p> : null}</div>)}</div></GlassCard></div> : null}</div>;
}