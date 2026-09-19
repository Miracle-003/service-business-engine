"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassCard } from "@/src/components/ui/glass-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { ErrorState, LoadingState } from "@/src/components/ui/states";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { useTenant } from "@/src/hooks/use-tenant";
import { apiClient } from "@/src/lib/api-client";

type Business = { id: string; name: string; slug: string; description?: string | null; status: string; email?: string | null; phone?: string | null; websiteUrl?: string | null };
type DataResponse<T> = { data: T };
type ListResponse<T> = { data: T[]; meta?: { total: number } };

export function BusinessDetail({ businessId }: { businessId: string }) {
  const { selectBusiness } = useTenant();
  const [business, setBusiness] = useState<Business | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    selectBusiness(businessId);
    let active = true;
    Promise.all([
      apiClient.get<DataResponse<Business>>(`/businesses/${businessId}`),
      ...(["locations", "services", "staff", "customers", "bookings", "quotes", "reviews"] as const).map(async (resource) => {
        const response = await apiClient.get<ListResponse<unknown>>(`/businesses/${businessId}/${resource}?page=1&pageSize=1`);
        return [resource, response.meta?.total ?? response.data.length] as const;
      }),
    ]).then(([businessResponse, ...resourceCounts]) => {
      if (!active) return;
      setBusiness(businessResponse.data);
      setCounts(Object.fromEntries(resourceCounts));
      setState("ready");
    }).catch((requestError) => {
      if (!active) return;
      setError(requestError instanceof Error ? requestError : new Error("Unable to load this business"));
      setState("error");
    });
    return () => { active = false; };
  }, [businessId, selectBusiness]);

  if (state === "loading") return <div className="mx-auto max-w-7xl"><LoadingState label="Loading business workspace" /></div>;
  if (state === "error" || !business) return <div className="mx-auto max-w-2xl"><ErrorState description={error?.message ?? "Business not found"} /></div>;

  const cards = [{ label: "Services", key: "services", href: "/services" }, { label: "Staff", key: "staff", href: "/staff" }, { label: "Customers", key: "customers", href: "/customers" }, { label: "Bookings", key: "bookings", href: "/bookings" }, { label: "Quotes", key: "quotes", href: "/quotes" }, { label: "Reviews", key: "reviews", href: "/reviews" }];
  return <div className="mx-auto max-w-7xl"><Link href="/businesses" className="mb-6 inline-flex text-sm text-slate-500 hover:text-white">← All businesses</Link><PageHeader eyebrow="Business workspace" title={business.name} description={business.description || "Configure the core operations for this business."} action={<StatusBadge status={business.status} tone={business.status === "ACTIVE" ? "success" : "neutral"} />} /><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <Link key={card.key} href={card.href}><GlassCard interactive className="p-6"><p className="text-sm text-slate-400">{card.label}</p><p className="mt-3 text-3xl font-semibold text-white">{counts[card.key] ?? 0}</p><p className="mt-3 text-xs text-indigo-300">Open {card.label.toLowerCase()} →</p></GlassCard></Link>)}</section><section className="mt-8 grid gap-5 lg:grid-cols-2"><GlassCard className="p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contact</p><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd className="text-right text-slate-200">{business.email || "Not set"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Phone</dt><dd className="text-right text-slate-200">{business.phone || "Not set"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Website</dt><dd className="text-right text-slate-200">{business.websiteUrl || "Not set"}</dd></div></dl></GlassCard><GlassCard className="p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configuration</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href={`/businesses/${businessId}/settings`} className="secondary-button text-center">Business settings</Link><Link href={`/businesses/${businessId}/locations`} className="secondary-button text-center">Locations</Link><Link href={`/businesses/${businessId}/hours`} className="secondary-button text-center">Opening hours</Link><Link href={`/businesses/${businessId}/holidays`} className="secondary-button text-center">Holidays</Link></div></GlassCard></section></div>;
}