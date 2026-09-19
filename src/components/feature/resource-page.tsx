"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { useTenant } from "@/src/hooks/use-tenant";
import { apiClient, ApiClientError } from "@/src/lib/api-client";

type ResourceName = "services" | "service-categories" | "staff" | "customers" | "bookings" | "quotes" | "reviews";
type Row = Record<string, unknown> & { id: string };
type Field = { name: string; label: string; type?: "text" | "number" | "email" | "textarea"; required?: boolean; placeholder?: string };

const configs: Record<ResourceName, { title: string; description: string; singular: string; fields: Field[]; columns: Array<{ key: string; label: string }> }> = {
  services: {
    title: "Services",
    description: "Keep your catalog clear, current, and easy for the team to manage.",
    singular: "service",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "slug", label: "Slug", required: true, placeholder: "service-slug" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "durationMinutes", label: "Duration (minutes)", type: "number", required: true },
      { name: "price", label: "Price", required: true, placeholder: "0.00" },
    ],
    columns: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "durationMinutes", label: "Duration" }, { key: "price", label: "Price" }, { key: "status", label: "Status" }],
  },
  "service-categories": {
    title: "Service categories",
    description: "Organize services into a structure that matches how customers browse your offering.",
    singular: "category",
    fields: [{ name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }, { name: "description", label: "Description", type: "textarea" }],
    columns: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "isActive", label: "Active" }],
  },
  staff: {
    title: "Staff",
    description: "Manage the people who deliver your services and connect their availability later.",
    singular: "staff member",
    fields: [{ name: "firstName", label: "First name", required: true }, { name: "lastName", label: "Last name" }, { name: "email", label: "Email", type: "email" }, { name: "title", label: "Title" }],
    columns: [{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "email", label: "Email" }, { key: "status", label: "Status" }],
  },
  customers: {
    title: "Customers",
    description: "A single, reliable view of the people your business serves.",
    singular: "customer",
    fields: [{ name: "firstName", label: "First name", required: true }, { name: "lastName", label: "Last name" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" }],
    columns: [{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "email", label: "Email" }, { key: "status", label: "Status" }],
  },
  bookings: {
    title: "Bookings",
    description: "Review and manage booking records returned by your business workspace.",
    singular: "booking",
    fields: [],
    columns: [{ key: "bookingNumber", label: "Booking" }, { key: "startsAt", label: "Starts" }, { key: "endsAt", label: "Ends" }, { key: "status", label: "Status" }, { key: "source", label: "Source" }],
  },
  quotes: {
    title: "Quotes",
    description: "Review quote records and keep the next customer conversation in view.",
    singular: "quote",
    fields: [],
    columns: [{ key: "quoteNumber", label: "Quote" }, { key: "status", label: "Status" }, { key: "total", label: "Total" }, { key: "validUntil", label: "Valid until" }],
  },
  reviews: {
    title: "Reviews",
    description: "Monitor customer feedback and respond from the same business workspace.",
    singular: "review",
    fields: [],
    columns: [{ key: "rating", label: "Rating" }, { key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "createdAt", label: "Created" }],
  },
};

type ListResponse = { data: Row[]; meta?: { total?: number } };

export function ResourcePage({ resource }: { resource: ResourceName }) {
  const config = configs[resource];
  const { businessId, activeMembership } = useTenant();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ListResponse>(`/businesses/${businessId}/${resource}?page=1&pageSize=100`);
      setRows(response.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load records"));
    } finally {
      setLoading(false);
    }
  }, [businessId, resource]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function remove(row: Row) {
    if (!businessId || !window.confirm(`Delete this ${config.singular}? This cannot be undone.`)) return;
    setError(null);
    try {
      await apiClient.delete(`/businesses/${businessId}/${resource}/${row.id}`);
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} deleted.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to delete this record"));
    }
  }

  const canCreate = config.fields.length > 0 && Boolean(activeMembership);
  return <div className="mx-auto max-w-7xl"><PageHeader eyebrow={activeMembership?.role.name ?? "Business workspace"} title={config.title} description={config.description} action={canCreate ? <button className="primary-button" onClick={() => { setEditing(null); setFormOpen(true); }}>Add {config.singular}</button> : null} />{notice ? <div role="status" className="notice-success mt-5">{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div> : null}{!businessId ? <div className="mt-8"><EmptyState title="No business selected" description="Choose a business from the tenant selector to load its records." /></div> : null}{businessId && loading ? <div className="mt-8"><LoadingState label={`Loading ${config.title.toLowerCase()}`} /></div> : null}{businessId && error ? <div className="mt-8"><ErrorState description={error instanceof ApiClientError && error.status === 403 ? "Your current membership does not have access to this resource." : error.message} onRetry={load} /></div> : null}{businessId && !loading && !error && rows.length === 0 ? <div className="mt-8"><EmptyState title={`No ${config.title.toLowerCase()} yet`} description={`When your workspace has ${config.title.toLowerCase()}, they will appear here.`} /></div> : null}{businessId && !loading && !error && rows.length > 0 ? <div className="mt-8"><ResourceTable resource={resource} rows={rows} columns={config.columns} onEdit={config.fields.length ? (row) => { setEditing(row); setFormOpen(true); } : undefined} onDelete={resource === "bookings" || resource === "quotes" || resource === "reviews" ? undefined : remove} /></div> : null}{formOpen ? <ResourceForm config={config} resource={resource} businessId={businessId} initial={editing} onClose={() => setFormOpen(false)} onSaved={async (message) => { setFormOpen(false); setNotice(message); await load(); }} /> : null}</div>;
}

function ResourceTable({ resource, rows, columns, onEdit, onDelete }: { resource: ResourceName; rows: Row[]; columns: Array<{ key: string; label: string }>; onEdit?: (row: Row) => void; onDelete?: (row: Row) => void }) {
  const detailResources: ResourceName[] = ["staff", "customers", "bookings", "quotes", "reviews"];
  return <GlassCard className="overflow-hidden"><div className="overflow-x-auto"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{onEdit || onDelete ? <th><span className="sr-only">Actions</span></th> : null}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column, index) => <td key={column.key}>{detailResources.includes(resource) && index === 0 ? <Link href={`/${resource}/${row.id}`} className="font-medium text-indigo-200 hover:text-white">{formatCell(row[column.key], column.key)}</Link> : formatCell(row[column.key], column.key)}</td>)}{onEdit || onDelete ? <td className="text-right"><div className="flex justify-end gap-3">{onEdit ? <button className="table-action" onClick={() => onEdit(row)}>Edit</button> : null}{onDelete ? <button className="table-action danger" onClick={() => onDelete(row)}>Delete</button> : null}</div></td> : null}</tr>)}</tbody></table></div></GlassCard>;
}

function formatCell(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-600">—</span>;
  if (key === "status") return <StatusBadge status={String(value)} />;
  if (key === "isActive") return <StatusBadge status={value ? "active" : "inactive"} tone={value ? "success" : "neutral"} />;
  if (key === "rating") return <span className="text-amber-200">{"★".repeat(Math.max(0, Math.min(5, Number(value))))}</span>;
  if (key.endsWith("At") || key === "validUntil") return <span className="whitespace-nowrap">{new Date(String(value)).toLocaleDateString()}</span>;
  return String(value);
}

function ResourceForm({ config, resource, businessId, initial, onClose, onSaved }: { config: (typeof configs)[ResourceName]; resource: ResourceName; businessId: string | null; initial: Row | null; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(config.fields.map((field) => [field.name, initial?.[field.name] == null ? "" : String(initial[field.name])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(initial);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { ...values };
    for (const field of config.fields) {
      if (field.type === "number" && values[field.name] !== "") body[field.name] = Number(values[field.name]);
      if (values[field.name] === "") delete body[field.name];
    }
    try {
      if (isEditing) await apiClient.patch(`/businesses/${businessId}/${resource}/${initial?.id}`, body);
      else await apiClient.post(`/businesses/${businessId}/${resource}`, body);
      await onSaved(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${isEditing ? "updated" : "created"}.`);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 422) setError(requestError.message);
      else setError(requestError instanceof Error ? requestError.message : "Unable to save this record");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"><GlassCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-[var(--panel-strong)] p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300/80">{isEditing ? "Edit" : "New"} {config.singular}</p><h2 className="mt-2 text-xl font-semibold text-white">{isEditing ? "Update record" : "Add to your workspace"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit} className="mt-7 space-y-4">{config.fields.map((field) => <label key={field.name} className="block text-sm text-slate-300">{field.label}{field.type === "textarea" ? <textarea required={field.required} value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} className="field mt-2 min-h-24 w-full resize-y" placeholder={field.placeholder} /> : <input required={field.required} type={field.type ?? "text"} value={values[field.name]} onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} className="field mt-2 w-full" placeholder={field.placeholder} />}</label>)}{error ? <p className="notice-error" role="alert">{error}</p> : null}<div className="flex justify-end gap-3 pt-3"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : isEditing ? "Save changes" : `Create ${config.singular}`}</button></div></form></GlassCard></div>;
}