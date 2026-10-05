"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/ui/states";
import { useAuth } from "@/src/hooks/use-auth";
import { useTenant } from "@/src/hooks/use-tenant";
import { ApiClientError, apiClient } from "@/src/lib/api-client";

type BusinessType = { id: string; name: string; slug: string; description?: string | null; status: string };
type Business = { id: string; name: string; slug: string; status: string; businessTypeId: string };
type ListResponse<T> = { data: T[]; meta?: { total?: number } };
type SetupRow = { id: string; [key: string]: unknown };
type FormValues = { name: string; businessTypeId: string; description: string; email: string; phone: string; websiteUrl: string; locationName: string; addressLine1: string; city: string; country: string; dayOfWeek: string; opensAt: string; closesAt: string; serviceName: string; serviceSlug: string; durationMinutes: string; price: string };

const initialValues: FormValues = { name: "", businessTypeId: "", description: "", email: "", phone: "", websiteUrl: "", locationName: "", addressLine1: "", city: "", country: "", dayOfWeek: "1", opensAt: "09:00", closesAt: "17:00", serviceName: "", serviceSlug: "", durationMinutes: "60", price: "" };
const steps = ["Identity", "Details", "Location", "Hours", "Services", "Review"];

export function BusinessOnboarding() {
  const auth = useAuth();
  const tenant = useTenant();
  const [types, setTypes] = useState<BusinessType[]>([]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdBusiness, setCreatedBusiness] = useState<Business | null>(null);
  const [setup, setSetup] = useState({ location: false, hours: false, service: false });
  const [notice, setNotice] = useState<string | null>(null);

  const update = (key: keyof FormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const selectedType = useMemo(() => types.find((type) => type.id === values.businessTypeId), [types, values.businessTypeId]);
  const isOwner = Boolean(createdBusiness && auth.status === "authenticated" && auth.memberships.some((membership) => membership.business.id === createdBusiness.id && membership.status === "ACTIVE" && membership.role.name.toLowerCase() === "owner"));
  const canManageCreatedBusiness = Boolean(createdBusiness && tenant.memberships.some((membership) => membership.business.id === createdBusiness.id && membership.status === "ACTIVE"));

  const loadTypes = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const response = await apiClient.get<{ data: BusinessType[] }>("/business-types?status=ACTIVE&page=1&pageSize=100");
      setTypes(response.data);
      setState(response.data.length ? "ready" : "empty");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to load business types"));
      setState("error");
    }
  }, []);

  const loadExistingBusiness = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const savedId = window.localStorage.getItem("serviceos.onboardingBusinessId");
    if (!savedId || !auth.memberships.some((membership) => membership.business.id === savedId && membership.status === "ACTIVE")) return;
    try {
      const [businessResponse, locationsResponse, hoursResponse, servicesResponse] = await Promise.all([
        apiClient.get<{ data: Business }>(`/businesses/${savedId}`),
        apiClient.get<ListResponse<SetupRow>>(`/businesses/${savedId}/locations?page=1&pageSize=1`),
        apiClient.get<ListResponse<SetupRow>>(`/businesses/${savedId}/hours?page=1&pageSize=1`),
        apiClient.get<ListResponse<SetupRow>>(`/businesses/${savedId}/services?page=1&pageSize=1`),
      ]);
      const business = businessResponse.data;
      setCreatedBusiness(business);
      tenant.selectBusiness(savedId);
      setSetup({ location: locationsResponse.data.length > 0, hours: hoursResponse.data.length > 0, service: servicesResponse.data.length > 0 });
      setValues((current) => ({ ...current, name: business.name, businessTypeId: business.businessTypeId }));
      setStep(5);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to resume business setup"));
    }
  }, [auth, tenant]);

  useEffect(() => { const timer = window.setTimeout(() => void loadTypes(), 0); return () => window.clearTimeout(timer); }, [loadTypes]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadExistingBusiness(), 0);
    return () => window.clearTimeout(timer);
  }, [loadExistingBusiness]);

  function next(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    if (step === 0 && (!values.name.trim() || !values.businessTypeId)) return setError(new Error("Choose a business type and enter a business name."));
    if (step === 2 && (!values.locationName.trim() || !values.addressLine1.trim() || !values.city.trim() || !values.country.trim())) return setError(new Error("Complete the required location fields."));
    if (step === 4 && (!values.serviceName.trim() || !values.serviceSlug.trim() || !values.price.trim())) return setError(new Error("Add your first service name, slug, and price."));
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function createBusiness() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const slug = values.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const response = await apiClient.post<{ data: { business: Business } }>("/businesses", { businessTypeId: values.businessTypeId, name: values.name, slug, description: values.description || undefined, email: values.email || undefined, phone: values.phone || undefined, websiteUrl: values.websiteUrl || undefined });
      const business = response.data.business;
      setCreatedBusiness(business);
      window.localStorage.setItem("serviceos.onboardingBusinessId", business.id);
      tenant.selectBusiness(business.id);
      await auth.refresh();
      setNotice("Business created and your OWNER membership is active.");
      setStep(2);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Unable to create this business"));
    } finally { setBusy(false); }
  }

  async function configureBusiness() {
    if (!createdBusiness || !isOwner || !canManageCreatedBusiness) { setError(new Error("Your owner membership is not available yet. Refresh your session and try again.")); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      if (!setup.location) { await apiClient.post(`/businesses/${createdBusiness.id}/locations`, { name: values.locationName, addressLine1: values.addressLine1, city: values.city, country: values.country }); setSetup((current) => ({ ...current, location: true })); }
      if (!setup.hours) { await apiClient.post(`/businesses/${createdBusiness.id}/hours`, { dayOfWeek: Number(values.dayOfWeek), opensAt: values.opensAt, closesAt: values.closesAt, isClosed: false }); setSetup((current) => ({ ...current, hours: true })); }
      if (!setup.service) { await apiClient.post(`/businesses/${createdBusiness.id}/services`, { name: values.serviceName, slug: values.serviceSlug, durationMinutes: Number(values.durationMinutes), price: values.price }); setSetup((current) => ({ ...current, service: true })); }
      setNotice("Your business setup is complete.");
      setStep(5);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError : new Error("Business was saved, but setup needs another try"));
    } finally { setBusy(false); }
  }

  if (state === "loading") return <LoadingState label="Loading real business types" />;
  if (state === "error") return <ErrorState title="Business setup unavailable" description={error?.message ?? "Unable to load business types"} onRetry={loadTypes} />;
  if (state === "empty") return <div className="onboarding-page"><EmptyState title="Business catalog needs setup" description="There are no active BusinessType records yet. A platform administrator must add at least one real business type before a business can be created." /><div className="mt-5 flex justify-center gap-3"><Link href="/admin" className="primary-button">Open platform setup</Link><button type="button" className="secondary-button" onClick={() => void loadTypes()}>Refresh catalog</button></div></div>;

  return <div className="onboarding-page"><div className="onboarding-heading"><div><p className="eyebrow">Business owner path</p><h1>Build the place your work can grow.</h1><p>Every step writes to the existing authenticated business contract.</p></div><Link href="/" className="quiet-link">Back to customer home →</Link></div><div className="stepper">{steps.map((label, index) => <div key={label} className={index <= step ? "step active" : "step"}><span>0{index + 1}</span>{label}</div>)}</div><div className="onboarding-card glass"><form onSubmit={next}>{step === 0 ? <Step title="Start with the shape of your business." description="Select a real BusinessType returned by the platform."><label className="form-label">Business name<input className="field" value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="Mirr Barber Studio" /></label><label className="form-label">Business type<select className="field" value={values.businessTypeId} onChange={(event) => update("businessTypeId", event.target.value)}><option value="">Choose a type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>{selectedType ? <p className="form-hint">{selectedType.description || selectedType.slug}</p> : null}</Step> : null}{step === 1 ? <Step title="Tell people what makes you different." description="These fields map directly to Business."><label className="form-label">Description<textarea className="field min-h-28" value={values.description} onChange={(event) => update("description", event.target.value)} /></label><label className="form-label">Business email<input className="field" type="email" value={values.email} onChange={(event) => update("email", event.target.value)} /></label><label className="form-label">Phone<input className="field" value={values.phone} onChange={(event) => update("phone", event.target.value)} /></label><label className="form-label">Website URL<input className="field" type="url" value={values.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} /></label></Step> : null}{step === 2 ? <Step title="Give the work a home." description="Add the first real BusinessLocation."><label className="form-label">Location name<input className="field" value={values.locationName} onChange={(event) => update("locationName", event.target.value)} /></label><label className="form-label">Address line 1<input className="field" value={values.addressLine1} onChange={(event) => update("addressLine1", event.target.value)} /></label><div className="form-grid"><label className="form-label">City<input className="field" value={values.city} onChange={(event) => update("city", event.target.value)} /></label><label className="form-label">Country<input className="field" value={values.country} onChange={(event) => update("country", event.target.value)} /></label></div></Step> : null}{step === 3 ? <Step title="Set a first rhythm." description="Opening hours use BusinessHours."><div className="form-grid"><label className="form-label">Day (0 Sunday - 6 Saturday)<input className="field" type="number" min="0" max="6" value={values.dayOfWeek} onChange={(event) => update("dayOfWeek", event.target.value)} /></label><span /></div><div className="form-grid"><label className="form-label">Opens at<input className="field" type="time" value={values.opensAt} onChange={(event) => update("opensAt", event.target.value)} /></label><label className="form-label">Closes at<input className="field" type="time" value={values.closesAt} onChange={(event) => update("closesAt", event.target.value)} /></label></div></Step> : null}{step === 4 ? <Step title="Put one clear service on the shelf." description="Add a first real Service record."><label className="form-label">Service name<input className="field" value={values.serviceName} onChange={(event) => update("serviceName", event.target.value)} /></label><label className="form-label">Service slug<input className="field" value={values.serviceSlug} onChange={(event) => update("serviceSlug", event.target.value)} /></label><div className="form-grid"><label className="form-label">Duration (minutes)<input className="field" type="number" min="1" value={values.durationMinutes} onChange={(event) => update("durationMinutes", event.target.value)} /></label><label className="form-label">Price<input className="field" value={values.price} onChange={(event) => update("price", event.target.value)} /></label></div></Step> : null}{step === 5 ? <Review values={values} selectedType={selectedType} createdBusiness={createdBusiness} setup={setup} isOwner={isOwner} /> : null}{error ? <p role="alert" className="notice-error mt-6">{error instanceof ApiClientError ? error.message : error.message}</p> : null}{notice ? <p role="status" className="notice-success mt-6">{notice}</p> : null}<div className="onboarding-actions">{step > 0 ? <button type="button" className="secondary-button" onClick={() => setStep((current) => current - 1)}>Back</button> : <span />}{createdBusiness && step === 5 ? <><Link href="/dashboard" className="primary-button">Open My Business</Link>{!setup.location || !setup.hours || !setup.service ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void configureBusiness()}>{busy ? "Saving…" : "Finish setup"}</button> : null}</> : createdBusiness ? <button className="primary-button">Continue <span aria-hidden="true">→</span></button> : step < steps.length - 1 ? <button className="primary-button">Continue <span aria-hidden="true">→</span></button> : <button type="button" className="primary-button" disabled={busy} onClick={() => void createBusiness()}>{busy ? "Creating…" : "Create business"}</button>}</div></form></div></div>;
}

function Step({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="step-content"><p className="eyebrow">Step in progress</p><h2>{title}</h2><p className="step-description">{description}</p><div className="form-stack">{children}</div></div>; }
function Review({ values, selectedType, createdBusiness, setup, isOwner }: { values: FormValues; selectedType?: BusinessType; createdBusiness: Business | null; setup: { location: boolean; hours: boolean; service: boolean }; isOwner: boolean }) { return <div className="step-content"><p className="eyebrow">Review</p><h2>{createdBusiness && isOwner && setup.location && setup.hours && setup.service ? "Your business is ready." : createdBusiness ? "Your business is real." : "Ready to make it real?"}</h2><p className="step-description">{createdBusiness ? "Ownership and setup are read from the real API." : "Review the records this flow will create through the existing API."}</p><div className="review-list"><div><span>Business</span><strong>{values.name}</strong><small>{selectedType?.name}</small></div><div><span>Location</span><strong>{setup.location ? "Configured" : values.locationName || "Not configured"}</strong><small>{values.city}, {values.country}</small></div><div><span>Hours</span><strong>{setup.hours ? "Configured" : "Not configured"}</strong><small>{values.opensAt} - {values.closesAt}</small></div><div><span>First service</span><strong>{setup.service ? "Configured" : values.serviceName || "Not configured"}</strong><small>{values.price} · {values.durationMinutes} minutes</small></div></div></div>; }
