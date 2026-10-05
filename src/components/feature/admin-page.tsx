"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";
import { ApiClientError, apiClient } from "@/src/lib/api-client";
import { useTenant } from "@/src/hooks/use-tenant";

type Role = { id: string; name: string; description?: string | null };
type Permission = { id: string; key: string; description?: string | null };
type AuditLog = { id: string; action: string; entityType?: string | null; createdAt: string; actorType: string };
type BusinessType = { id: string; name: string; slug: string; description?: string | null; status: string };
type ListResponse<T> = { data: T[]; meta?: { total: number } };

export function AdminPage() {
  const { businessId } = useTenant();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [typeForm, setTypeForm] = useState({ name: "", slug: "", description: "" });
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeBusy, setTypeBusy] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      setCatalogError(null);
      const [rolesResult, permissionsResult, activityResult, businessTypesResult] = await Promise.allSettled([
        apiClient.get<ListResponse<Role>>("/roles?page=1&pageSize=100"),
        apiClient.get<ListResponse<Permission>>("/permissions?page=1&pageSize=100"),
        businessId ? apiClient.get<ListResponse<AuditLog>>(`/businesses/${businessId}/audit-logs?page=1&pageSize=8`) : Promise.resolve({ data: [] } as ListResponse<AuditLog>),
        apiClient.get<{ data: BusinessType[] }>("/business-types?status=ACTIVE&page=1&pageSize=100"),
      ]);
      if (rolesResult.status === "fulfilled") setRoles(rolesResult.value.data);
      if (permissionsResult.status === "fulfilled") setPermissions(permissionsResult.value.data);
      if (activityResult.status === "fulfilled") setActivity(activityResult.value.data);
      if (businessTypesResult.status === "fulfilled") setBusinessTypes(businessTypesResult.value.data);
      else setCatalogError(businessTypesResult.reason instanceof Error ? businessTypesResult.reason.message : "Unable to load business types");
      setState("ready");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load platform data"));
      setState("error");
    }
  }, [businessId]);

  async function createBusinessType(event: FormEvent) {
    event.preventDefault();
    setTypeBusy(true);
    setTypeError(null);
    try {
      await apiClient.post("/business-types", { name: typeForm.name, slug: typeForm.slug, description: typeForm.description || undefined });
      setTypeForm({ name: "", slug: "", description: "" });
      const response = await apiClient.get<{ data: BusinessType[] }>("/business-types?status=ACTIVE&page=1&pageSize=100");
      setBusinessTypes(response.data);
    } catch (requestError) {
      setTypeError(requestError instanceof Error ? requestError.message : "Unable to create business type");
    } finally {
      setTypeBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (state === "loading") return <LoadingState label="Loading platform activity" />;
  if (state === "error") return <ErrorState description={error instanceof ApiClientError && error.status === 403 ? "Your current account does not have platform administration access." : error?.message ?? "Unable to load access control data"} onRetry={load} />;
  if (state === "empty") return <EmptyState title="No platform records yet" description="Roles, permissions, and audit events will appear here when returned by the backend." />;

  return (
    <div className="admin-console mx-auto max-w-7xl">
      <div className="admin-banner">
        <div>
          <p className="eyebrow">Platform control</p>
          <h1>Administration</h1>
          <p>Access governance and real activity from the existing platform contracts.</p>
        </div>
        <span className="admin-pill">Restricted surface</span>
      </div>
      <div className="admin-nav"><span>Access control</span><span>Activity</span><span>Business scope: {businessId ? "selected" : "not selected"}</span></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-white">Roles, permissions & catalog</h2>
          <div className="mt-5 space-y-3">
            {roles.map((role) => <div key={role.id} className="rounded-2xl border border-white/8 bg-white/3 p-4"><p className="font-medium text-white">{role.name}</p><p className="mt-1 text-sm text-slate-400">{role.description || "No description"}</p></div>)}
          </div>
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-500">Permission catalog</p>
            {permissions.slice(0, 8).map((permission) => <p key={permission.id} className="py-1 font-mono text-xs text-indigo-200">{permission.key}</p>)}
          </div>
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-500">Business types</p>
            {catalogError ? <p className="text-xs text-rose-200">{catalogError}</p> : businessTypes.length ? <div className="space-y-2">{businessTypes.map((type) => <div key={type.id} className="flex justify-between gap-3 text-sm text-white"><span>{type.name}</span><span className="text-xs text-slate-500">{type.slug}</span></div>)}</div> : <p className="text-xs text-amber-200">No active types configured.</p>}
            <form onSubmit={createBusinessType} className="mt-4 space-y-2">
              <input className="field w-full text-xs" placeholder="Type name" value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} required />
              <input className="field w-full text-xs" placeholder="type-slug" value={typeForm.slug} onChange={(event) => setTypeForm({ ...typeForm, slug: event.target.value })} required />
              <input className="field w-full text-xs" placeholder="Description (optional)" value={typeForm.description} onChange={(event) => setTypeForm({ ...typeForm, description: event.target.value })} />
              {typeError ? <p className="text-xs text-rose-200">{typeError}</p> : null}
              <button className="secondary-button w-full text-xs" disabled={typeBusy}>{typeBusy ? "Adding…" : "Add business type"}</button>
            </form>
          </div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Recent activity</p><h2 className="text-lg font-semibold text-white">What changed</h2></div><span className="text-xs text-slate-500">AuditLog data</span></div>
          {activity.length ? <div className="mt-5 space-y-3">{activity.map((item) => <div key={item.id} className="activity-row"><span className="activity-dot" /><div><p className="text-sm text-white">{item.action.replaceAll("_", " ")} <span className="text-slate-500">{item.entityType || "record"}</span></p><p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()} · {item.actorType}</p></div></div>)}</div> : <EmptyState title="No activity in this business" description="Real audit events will appear here after supported mutations." />}
        </GlassCard>
      </div>
    </div>
  );
}
