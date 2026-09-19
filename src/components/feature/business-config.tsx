"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { useTenant } from "@/src/hooks/use-tenant";
import { apiClient, ApiClientError } from "@/src/lib/api-client";

type ConfigKind = "settings" | "locations" | "hours" | "holidays";
type Row = Record<string, unknown> & { id: string };
type ListResponse = { data: Row[]; meta?: { total?: number } };

const configCopy: Record<ConfigKind, { title: string; description: string; singular: string }> = {
  settings: { title: "Business settings", description: "Set the operating defaults that guide this business workspace.", singular: "setting" },
  locations: { title: "Locations", description: "Keep each place where your team delivers services in one reliable list.", singular: "location" },
  hours: { title: "Opening hours", description: "Define the hours your business or individual locations are open.", singular: "hours row" },
  holidays: { title: "Holidays", description: "Record days when your business is closed or operating differently.", singular: "holiday" },
};

export function BusinessConfigPage({ kind, businessId: routeBusinessId }: { kind: ConfigKind; businessId?: string }) {
  const tenant = useTenant();
  const businessId = routeBusinessId ?? tenant.businessId;
  const copy = configCopy[kind];
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (kind === "settings") {
        const response = await apiClient.get<{ data: Row }>(`/businesses/${businessId}/settings`);
        setSettings(response.data);
      } else {
        const response = await apiClient.get<ListResponse>(`/businesses/${businessId}/${kind}?page=1&pageSize=100`);
        setRows(response.data);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error(`Unable to load ${copy.title.toLowerCase()}`));
    } finally {
      setLoading(false);
    }
  }, [businessId, copy.title, kind]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(id: string) {
    if (!businessId || !window.confirm(`Delete this ${copy.singular}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/businesses/${businessId}/${kind}/${id}`);
      setNotice(`${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} deleted.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to delete this record"));
    }
  }

  if (!businessId) return <div className="mx-auto max-w-7xl"><PageHeader eyebrow="Business workspace" title={copy.title} description={copy.description} /><div className="mt-8"><EmptyState title="No business selected" description="Choose a business from the tenant selector to manage this area." /></div></div>;
  return <div className="mx-auto max-w-7xl"><PageHeader eyebrow={tenant.activeMembership?.role.name ?? "Business workspace"} title={copy.title} description={copy.description} action={kind === "settings" ? null : <button className="primary-button" onClick={() => setFormOpen(true)}>Add {copy.singular}</button>} />{notice ? <div role="status" className="notice-success mt-5">{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div> : null}{loading ? <div className="mt-8"><LoadingState label={`Loading ${copy.title.toLowerCase()}`} /></div> : null}{error ? <div className="mt-8"><ErrorState description={error instanceof ApiClientError && error.status === 403 ? "Your membership does not have permission to manage this area." : error.message} onRetry={load} /></div> : null}{!loading && !error && kind === "settings" ? <SettingsCard businessId={businessId} settings={settings} onSaved={async (message) => { setNotice(message); await load(); }} /> : null}{!loading && !error && kind !== "settings" && rows.length === 0 ? <div className="mt-8"><EmptyState title={`No ${copy.title.toLowerCase()} yet`} description={`Add the first ${copy.singular} for this business when you are ready.`} /></div> : null}{!loading && !error && kind !== "settings" && rows.length > 0 ? <div className="mt-8"><ConfigTable kind={kind} rows={rows} onDelete={kind === "holidays" ? remove : undefined} /></div> : null}{formOpen ? <ConfigForm kind={kind} businessId={businessId} onClose={() => setFormOpen(false)} onSaved={async (message) => { setFormOpen(false); setNotice(message); await load(); }} /> : null}</div>;
}

function SettingsCard({ businessId, settings, onSaved }: { businessId: string; settings: Row | null; onSaved: (message: string) => Promise<void> }) {
  const [values, setValues] = useState({ currency: String(settings?.currency ?? "USD"), timezone: String(settings?.timezone ?? "UTC"), bookingEnabled: settings?.bookingEnabled !== false, quoteEnabled: settings?.quoteEnabled !== false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/businesses/${businessId}/settings`, values);
      await onSaved("Business settings saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save settings");
    } finally {
      setBusy(false);
    }
  }
  return <GlassCard className="mt-8 max-w-2xl p-6 sm:p-8"><form onSubmit={save} className="space-y-5"><label className="block text-sm text-slate-300">Currency<input className="field mt-2 w-full" value={values.currency} onChange={(event) => setValues({ ...values, currency: event.target.value })} required /></label><label className="block text-sm text-slate-300">Timezone<input className="field mt-2 w-full" value={values.timezone} onChange={(event) => setValues({ ...values, timezone: event.target.value })} required /></label><label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={values.bookingEnabled} onChange={(event) => setValues({ ...values, bookingEnabled: event.target.checked })} /> Booking enabled</label><label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={values.quoteEnabled} onChange={(event) => setValues({ ...values, quoteEnabled: event.target.checked })} /> Quote requests enabled</label>{error ? <p role="alert" className="notice-error">{error}</p> : null}<div className="flex justify-end"><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div></form></GlassCard>;
}

function ConfigTable({ kind, rows, onDelete }: { kind: ConfigKind; rows: Row[]; onDelete?: (id: string) => Promise<void> }) {
  const columns = kind === "locations" ? ["name", "city", "country", "isActive"] : kind === "hours" ? ["dayOfWeek", "opensAt", "closesAt", "isClosed"] : ["date", "name", "isClosed"];
  return <GlassCard className="overflow-hidden"><div className="overflow-x-auto"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column === "dayOfWeek" ? "Day" : column.replace(/([A-Z])/g, " $1")}</th>)}{onDelete ? <th><span className="sr-only">Actions</span></th> : null}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column}>{configCell(row[column], column)}</td>)}{onDelete ? <td className="text-right"><button className="table-action danger" onClick={() => void onDelete(row.id)}>Delete</button></td> : null}</tr>)}</tbody></table></div></GlassCard>;
}

function configCell(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-600">—</span>;
  if (key === "isActive" || key === "isClosed") return <StatusBadge status={value ? (key === "isClosed" ? "closed" : "active") : key === "isClosed" ? "open" : "inactive"} tone={value === true && key === "isClosed" ? "warning" : value ? "success" : "neutral"} />;
  if (key === "date") return new Date(String(value)).toLocaleDateString();
  if (key === "dayOfWeek") return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(value)] ?? String(value);
  return String(value);
}

function ConfigForm({ kind, businessId, onClose, onSaved }: { kind: ConfigKind; businessId: string; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({ name: "", addressLine1: "", city: "", country: "", date: "", isClosed: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = kind === "locations" ? ["name", "addressLine1", "city", "country"] : kind === "holidays" ? ["date", "name"] : ["dayOfWeek", "opensAt", "closesAt"];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
    try {
      await apiClient.post(`/businesses/${businessId}/${kind}`, body);
      await onSaved(`${kind === "locations" ? "Location" : "Holiday"} created.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create this record");
    } finally {
      setBusy(false);
    }
  }
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"><GlassCard className="w-full max-w-lg bg-[var(--panel-strong)] p-6 sm:p-8"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">Add {kind === "locations" ? "location" : kind === "holidays" ? "holiday" : "opening-hours row"}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit} className="mt-6 space-y-4">{fields.map((field) => <label key={field} className="block text-sm text-slate-300">{field.replace(/([A-Z])/g, " $1")}<input className="field mt-2 w-full" type={field === "dayOfWeek" ? "number" : "text"} min={field === "dayOfWeek" ? 0 : undefined} max={field === "dayOfWeek" ? 6 : undefined} required value={String(values[field] ?? "")} onChange={(event) => setValues({ ...values, [field]: event.target.value })} /></label>)}{kind === "holidays" ? <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(values.isClosed)} onChange={(event) => setValues({ ...values, isClosed: event.target.checked })} /> Closed all day</label> : null}{kind === "hours" ? <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={Boolean(values.isClosed)} onChange={(event) => setValues({ ...values, isClosed: event.target.checked })} /> Closed all day</label> : null}{error ? <p role="alert" className="notice-error">{error}</p> : null}<div className="flex justify-end gap-3"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Create"}</button></div></form></GlassCard></div>;
}