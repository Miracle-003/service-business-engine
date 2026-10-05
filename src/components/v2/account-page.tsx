"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/src/hooks/use-auth";
import { apiClient } from "@/src/lib/api-client";
import { ErrorState } from "@/src/components/ui/states";

export function AccountPage() {
  const auth = useAuth();
  const [name, setName] = useState(() => auth.status === "authenticated" ? `${auth.user.firstName ?? ""} ${auth.user.lastName ?? ""}`.trim() : "");
  const [phone, setPhone] = useState(() => auth.status === "authenticated" ? auth.user.phone ?? "" : "");
  const [bio, setBio] = useState(() => String(auth.profile?.bio ?? ""));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status !== "authenticated") return <ErrorState title="Account unavailable" description="Sign in to view your account." />;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const [firstName, ...lastParts] = name.trim().split(/\s+/);
    try {
      await apiClient.patch("/users/me", { firstName: firstName || null, lastName: lastParts.join(" ") || null, phone: phone || null });
      await apiClient.patch("/profiles/me", { bio: bio || null });
      await auth.refresh();
      setNotice("Your account details are saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save your account");
    } finally { setBusy(false); }
  }

  return <div className="account-page"><div className="account-heading"><div><p className="eyebrow">Your account</p><h1>Keep your details close.</h1><p>Manage the real User and Profile fields connected to your Supabase account.</p></div><span className="account-email">{auth.user.email}</span></div><div className="account-grid"><form className="glass account-card" onSubmit={save}><p className="eyebrow">Profile</p><h2>How should we address you?</h2><label className="form-label">Name<input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-label">Phone<input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="form-label">Bio<textarea className="field min-h-28" value={bio} onChange={(event) => setBio(event.target.value)} /></label>{error ? <p className="notice-error">{error}</p> : null}{notice ? <p className="notice-success">{notice}</p> : null}<button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></form><div className="glass account-card"><p className="eyebrow">Access</p><h2>Your spaces</h2>{auth.memberships.length ? <div className="account-memberships">{auth.memberships.map((membership) => <div key={membership.id}><span>{membership.business.name}</span><small>{membership.role.name}</small></div>)}</div> : <p className="account-muted">You are currently a customer without a business workspace.</p>}<button type="button" className="secondary-button" onClick={() => void auth.signOut()}>Sign out</button></div></div></div>;
}
