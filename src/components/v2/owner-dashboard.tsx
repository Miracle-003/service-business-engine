"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/src/hooks/use-tenant";
import { apiClient, ApiClientError } from "@/src/lib/api-client";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";

const nav = [
  ["Overview", "/dashboard"],
  ["Business profile", "/businesses"],
  ["Services", "/services"],
  ["Staff", "/staff"],
  ["Locations", "/businesses/active/locations"],
  ["Opening hours", "/businesses/active/hours"],
  ["Holidays", "/businesses/active/holidays"],
  ["Customers", "/customers"],
  ["Bookings", "/bookings"],
  ["Quotes", "/quotes"],
  ["Reviews", "/reviews"],
];

type CountResponse = { data: unknown[]; meta?: { total?: number } };
type BusinessResponse = { data: { id: string; name: string; description?: string | null; status: string } };

export function OwnerDashboard() {
  const { businessId, activeMembership } = useTenant();
  const [business, setBusiness] = useState<BusinessResponse["data"] | null>(null);
  const [counts, setCounts] = useState({ bookings: 0, customers: 0, services: 0, reviews: 0 });
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!businessId) {
      setState("empty");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const [businessResponse, bookings, customers, services, reviews] = await Promise.all([
        apiClient.get<BusinessResponse>(`/businesses/${businessId}`),
        apiClient.get<CountResponse>(`/businesses/${businessId}/bookings?page=1&pageSize=1`),
        apiClient.get<CountResponse>(`/businesses/${businessId}/customers?page=1&pageSize=1`),
        apiClient.get<CountResponse>(`/businesses/${businessId}/services?page=1&pageSize=1`),
        apiClient.get<CountResponse>(`/businesses/${businessId}/reviews?page=1&pageSize=1`),
      ]);
      setBusiness(businessResponse.data);
      setCounts({ bookings: bookings.meta?.total ?? bookings.data.length, customers: customers.meta?.total ?? customers.data.length, services: services.meta?.total ?? services.data.length, reviews: reviews.meta?.total ?? reviews.data.length });
      setState("ready");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load this business workspace"));
      setState("error");
    }
  }, [businessId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  if (state === "loading") return <LoadingState label="Loading your business workspace" />;
  if (state === "empty") return <div className="owner-empty"><EmptyState title="Choose a business to begin" description="Use the active-business selector above, or start a new business workspace." /><Link href="/dashboard/onboarding" className="primary-button mt-5">Start your business</Link></div>;
  if (state === "error") return <ErrorState title={error instanceof ApiClientError && error.status === 403 ? "Business access unavailable" : "Workspace unavailable"} description={error?.message ?? "Unable to load this business workspace"} onRetry={load} />;

  const cards: Array<{ label: string; value: number; href: string; note: string }> = [
    { label: "Bookings", value: counts.bookings, href: "/bookings", note: "Appointments in this workspace" },
    { label: "Customers", value: counts.customers, href: "/customers", note: "Customer records" },
    { label: "Services", value: counts.services, href: "/services", note: "Published or draft services" },
    { label: "Reviews", value: counts.reviews, href: "/reviews", note: "Customer feedback" },
  ];
  return <div className="owner-dashboard">
    <div className="owner-dashboard-head"><div><p className="eyebrow">{activeMembership?.role.name ?? "Business workspace"}</p><h1>{business?.name}</h1><p>{business?.description || "Your operating view for the work behind every appointment."}</p></div><div className="owner-head-actions"><Link href="/businesses" className="secondary-button">Business profile</Link><Link href="/dashboard/onboarding" className="primary-button">Add to workspace</Link></div></div>
    <div className="owner-nav">{nav.map(([label, href]) => <Link key={label} href={href.replace("/active", businessId ? `/${businessId}` : "")}>{label}</Link>)}</div>
    <section className="metric-grid">{cards.map((card) => <Link key={card.label} href={card.href} className="metric-card glass"><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></Link>)}</section>
    <section className="dashboard-lower"><div className="glass dashboard-panel"><div className="section-heading"><div><p className="eyebrow">Today</p><h2>Keep the next move visible.</h2></div><Link href="/bookings" className="quiet-link">View bookings →</Link></div>{counts.bookings === 0 ? <EmptyState title="No bookings yet" description="When bookings are created through the business contract, they will appear in this workspace." /> : <p className="dashboard-placeholder">{counts.bookings} booking record{counts.bookings === 1 ? "" : "s"} available. Open Bookings for the full list.</p>}</div><div className="glass dashboard-panel"><p className="eyebrow">Setup</p><h2>Make the workspace yours.</h2><div className="setup-list"><Link href={businessId ? `/businesses/${businessId}/settings` : "/businesses"}>Business settings <span>→</span></Link><Link href="/services">Add a service <span>→</span></Link><Link href="/staff">Add your team <span>→</span></Link></div></div></section>
  </div>;
}
