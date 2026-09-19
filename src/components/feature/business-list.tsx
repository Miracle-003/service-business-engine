"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { apiClient } from "@/src/lib/api-client";
import { useTenant } from "@/src/hooks/use-tenant";

type Business = { id: string; name: string; slug: string; description?: string | null; status: string; email?: string | null; city?: string | null };
type Response = { data: Business[]; meta?: { total: number } };

export function BusinessList() {
  const { selectBusiness } = useTenant();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await apiClient.get<Response>("/businesses?page=1&pageSize=100");
      setBusinesses(response.data);
      setState(response.data.length ? "ready" : "empty");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load businesses"));
      setState("error");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <div className="mx-auto max-w-7xl"><PageHeader eyebrow="Tenant management" title="Businesses" description="Choose a workspace to manage its settings, team, services, and customer operations." />{state === "loading" ? <div className="mt-8"><LoadingState label="Loading businesses" /></div> : null}{state === "error" ? <div className="mt-8"><ErrorState description={error?.message ?? "Unable to load businesses"} onRetry={load} /></div> : null}{state === "empty" ? <div className="mt-8"><EmptyState title="No businesses yet" description="Your authenticated account does not have an active business membership yet." /></div> : null}{state === "ready" ? <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{businesses.map((business) => <GlassCard key={business.id} interactive className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-slate-500">{business.slug}</p><h2 className="mt-2 text-lg font-semibold text-white">{business.name}</h2></div><StatusBadge status={business.status} tone={business.status === "ACTIVE" ? "success" : "neutral"} /></div><p className="mt-4 min-h-12 text-sm leading-6 text-slate-400">{business.description || "No description added yet."}</p><div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4"><span className="truncate text-xs text-slate-500">{business.email || "No email"}</span><Link href={`/businesses/${business.id}`} onClick={() => selectBusiness(business.id)} className="table-action">Open workspace →</Link></div></GlassCard>)}</div> : null}</div>;
}