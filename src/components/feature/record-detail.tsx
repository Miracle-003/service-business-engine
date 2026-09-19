"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { ErrorState, LoadingState } from "@/src/components/ui/states";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { useTenant } from "@/src/hooks/use-tenant";
import { apiClient } from "@/src/lib/api-client";

type DetailResource = "staff" | "customers" | "bookings" | "quotes" | "reviews";
type Row = Record<string, unknown> & { id: string };
type Response<T> = { data: T };
type ListResponse = { data: Row[]; meta?: { total?: number } };

const resourceLabels: Record<DetailResource, string> = {
  staff: "Staff member",
  customers: "Customer",
  bookings: "Booking",
  quotes: "Quote",
  reviews: "Review",
};

export function RecordDetail({ resource, recordId }: { resource: DetailResource; recordId: string }) {
  const { businessId } = useTenant();
  const [record, setRecord] = useState<Row | null>(null);
  const [children, setChildren] = useState<Record<string, Row[]>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) {
      setState("error");
      setError(new Error("No active business is selected"));
      return;
    }
    setState("loading");
    setError(null);
    try {
      const childPaths: Record<DetailResource, string[]> = {
        staff: ["availability", "time-off"],
        customers: ["addresses", "notes", "preferences"],
        bookings: ["items", "status-history"],
        quotes: ["items"],
        reviews: ["response"],
      };
      const base = `/businesses/${businessId}/${resource}/${recordId}`;
      const recordResponse = await apiClient.get<Response<Row>>(base);
      const childResults = await Promise.all(childPaths[resource].map(async (child) => {
        if (child === "preferences" || child === "response") {
          const response = await apiClient.get<Response<Row | null>>(`${base}/${child}`);
          return [child, response.data ? [response.data] : []] as const;
        }
        const response = await apiClient.get<ListResponse>(`${base}/${child}?page=1&pageSize=100`);
        return [child, response.data] as const;
      }));
      setRecord(recordResponse.data);
      setChildren(Object.fromEntries(childResults));
      setState("ready");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load this record"));
      setState("error");
    }
  }, [businessId, recordId, resource]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (state === "loading") return <div className="mx-auto max-w-7xl"><LoadingState label={`Loading ${resourceLabels[resource].toLowerCase()}`} /></div>;
  if (state === "error" || !record) return <div className="mx-auto max-w-2xl"><ErrorState description={error?.message ?? "Record not found"} onRetry={load} /></div>;
  const title = String(record.name ?? record.firstName ?? record.bookingNumber ?? record.quoteNumber ?? record.title ?? resourceLabels[resource]);
  const backPath = `/${resource}`;
  return <div className="mx-auto max-w-7xl"><Link href={backPath} className="mb-6 inline-flex text-sm text-slate-500 hover:text-white">← Back to {resource}</Link><PageHeader eyebrow={resourceLabels[resource]} title={title} description={detailDescription(resource, record)} action={record.status ? <StatusBadge status={String(record.status)} /> : null} />{notice ? <div role="status" className="notice-success mt-5">{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div> : null}<div className="mt-8 grid gap-5 lg:grid-cols-2"><RecordSummary resource={resource} record={record} />{resource === "bookings" ? <BookingStatusForm businessId={businessId as string} bookingId={recordId} currentStatus={String(record.status ?? "PENDING")} onSaved={async (message) => { setNotice(message); await load(); }} /> : null}{resource === "reviews" ? <ReviewResponse businessId={businessId as string} reviewId={recordId} response={children.response?.[0] ?? null} onSaved={async (message) => { setNotice(message); await load(); }} /> : null}</div><ChildSections sections={children} /></div>;
}

function detailDescription(resource: DetailResource, record: Row) {
  if (resource === "customers") return [record.email, record.phone].filter(Boolean).join(" · ") || "Customer information from the selected business.";
  if (resource === "staff") return [record.title, record.email].filter(Boolean).join(" · ") || "Staff information from the selected business.";
  if (resource === "bookings") return "Booking details and status history from the selected business.";
  if (resource === "quotes") return "Quote details and line items from the selected business.";
  return "Review details and response from the selected business.";
}

function RecordSummary({ resource, record }: { resource: DetailResource; record: Row }) {
  const keys = resource === "customers" ? ["email", "phone", "status"] : resource === "staff" ? ["lastName", "email", "title", "status"] : resource === "bookings" ? ["bookingNumber", "startsAt", "endsAt", "source", "customerNote"] : resource === "quotes" ? ["quoteNumber", "total", "currency", "validUntil", "notes"] : ["rating", "content", "createdAt"];
  return <GlassCard className="p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Record details</p><dl className="mt-5 space-y-4">{keys.map((key) => <div key={key} className="flex justify-between gap-5 border-b border-white/6 pb-3 text-sm last:border-0 last:pb-0"><dt className="capitalize text-slate-500">{key.replace(/([A-Z])/g, " $1")}</dt><dd className="max-w-[65%] text-right text-slate-200">{key === "status" ? <StatusBadge status={String(record[key] ?? "unknown")} /> : key === "rating" ? <span className="text-amber-200">{"★".repeat(Number(record[key] ?? 0))}</span> : record[key] == null || record[key] === "" ? "—" : key.endsWith("At") || key === "validUntil" ? new Date(String(record[key])).toLocaleString() : String(record[key])}</dd></div>)}</dl></GlassCard>;
}

function ChildSections({ sections }: { sections: Record<string, Row[]> }) {
  const entries = Object.entries(sections);
  return <section className="mt-5 grid gap-5 lg:grid-cols-2">{entries.map(([name, rows]) => <GlassCard key={name} className="p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold capitalize text-white">{name.replace("-", " ")}</h2><span className="text-xs text-slate-500">{rows.length} record{rows.length === 1 ? "" : "s"}</span></div>{rows.length === 0 ? <p className="mt-5 text-sm text-slate-500">No {name.replace("-", " ")} recorded.</p> : <div className="mt-5 space-y-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-white/8 bg-white/3 p-4 text-sm"><ChildRow child={name} row={row} /></div>)}</div>}</GlassCard>)}</section>;
}

function ChildRow({ child, row }: { child: string; row: Row }) {
  const preferred = child === "availability" ? ["dayOfWeek", "startsAt", "endsAt"] : child === "time-off" ? ["startsAt", "endsAt", "reason"] : child === "status-history" ? ["fromStatus", "toStatus", "reason", "changedAt"] : child === "response" ? ["content", "createdAt"] : ["name", "description", "quantity", "unitPrice", "total", "addressLine1", "city", "country", "content"];
  const keys = preferred.filter((key) => row[key] !== undefined);
  return <div className="space-y-2">{keys.length ? keys.map((key) => <p key={key} className="text-slate-300"><span className="mr-2 capitalize text-slate-500">{key.replace(/([A-Z])/g, " $1")}:</span>{key === "status" || key === "toStatus" ? <StatusBadge status={String(row[key])} /> : String(row[key] ?? "—")}</p>) : <p className="text-slate-400">{JSON.stringify(row)}</p>}</div>;
}

function BookingStatusForm({ businessId, bookingId, currentStatus, onSaved }: { businessId: string; bookingId: string; currentStatus: string; onSaved: (message: string) => Promise<void> }) {
  const [toStatus, setToStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const statuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "DECLINED"];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiClient.patch(`/businesses/${businessId}/bookings/${bookingId}/status`, { toStatus, reason: reason || null });
      await onSaved("Booking status updated.");
    } finally {
      setBusy(false);
    }
  }
  return <GlassCard className="p-6"><h2 className="text-lg font-semibold text-white">Update status</h2><form onSubmit={submit} className="mt-5 space-y-4"><select className="field w-full" value={toStatus} onChange={(event) => setToStatus(event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select><input className="field w-full" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" /><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save status"}</button></form></GlassCard>;
}

function ReviewResponse({ businessId, reviewId, response, onSaved }: { businessId: string; reviewId: string; response: Row | null; onSaved: (message: string) => Promise<void> }) {
  const [content, setContent] = useState(String(response?.content ?? ""));
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiClient.put(`/businesses/${businessId}/reviews/${reviewId}/response`, { content });
      await onSaved("Review response saved.");
    } finally {
      setBusy(false);
    }
  }
  return <GlassCard className="p-6"><h2 className="text-lg font-semibold text-white">Review response</h2><form onSubmit={save} className="mt-5 space-y-4"><textarea className="field min-h-28 w-full" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a response" required /><button className="primary-button" disabled={busy}>{busy ? "Saving…" : response ? "Update response" : "Add response"}</button></form></GlassCard>;
}