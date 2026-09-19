"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

type AuthMode = "login" | "register" | "forgot" | "reset";

const copy: Record<AuthMode, { eyebrow: string; title: string; description: string; submit: string }> = {
  login: { eyebrow: "Welcome back", title: "Sign in to ServiceOS", description: "Use your existing workspace account to continue.", submit: "Sign in" },
  register: { eyebrow: "Create your account", title: "Start with ServiceOS", description: "Create a Supabase account, then complete your workspace access.", submit: "Create account" },
  forgot: { eyebrow: "Account recovery", title: "Reset your password", description: "We’ll send a secure recovery link to your email.", submit: "Send recovery link" },
  reset: { eyebrow: "New password", title: "Choose a new password", description: "Set a new password for your existing account.", submit: "Update password" },
};

export function AuthPanel({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const content = copy[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      let result: { error: Error | null };

      if (mode === "login") {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else if (mode === "register") {
        result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      } else if (mode === "forgot") {
        result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` });
      } else {
        result = await supabase.auth.updateUser({ password });
      }

      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (mode === "login") {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.assign(next?.startsWith("/") ? next : "/");
      } else if (mode === "register") {
        setMessage("Account created. Check your email if confirmation is required, then sign in.");
      } else if (mode === "forgot") {
        setMessage("If an account exists for that email, a recovery link has been sent.");
      } else {
        setMessage("Password updated. You can now sign in.");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reach the authentication service");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10"><div className="w-full"><Link href="/" className="mb-10 flex items-center gap-3 text-sm font-semibold text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/15 text-sm text-indigo-200 ring-1 ring-indigo-300/20">SB</span>ServiceOS</Link><div className="glass rounded-3xl p-7 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">{content.eyebrow}</p><h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">{content.title}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{content.description}</p><form onSubmit={submit} className="mt-8 space-y-4">{mode === "register" ? <label className="block text-sm text-slate-300">Name<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="field mt-2 w-full" placeholder="Your name" /></label> : null}{mode !== "reset" ? <label className="block text-sm text-slate-300">Email<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field mt-2 w-full" placeholder="you@example.com" /></label> : null}{mode !== "forgot" ? <label className="block text-sm text-slate-300">Password<input required autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-2 w-full" placeholder="••••••••" /></label> : null}{error ? <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/8 p-3 text-sm text-rose-200">{error}</p> : null}{message ? <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-400/8 p-3 text-sm text-emerald-200">{message}</p> : null}<button disabled={busy} className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60">{busy ? "Working…" : content.submit}</button></form><AuthLinks mode={mode} /></div></div></div>;
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  if (mode === "login") return <div className="mt-6 flex justify-between gap-3 text-xs text-slate-500"><Link href="/auth/forgot-password" className="hover:text-indigo-300">Forgot password?</Link><Link href="/auth/register" className="hover:text-indigo-300">Create account</Link></div>;
  if (mode === "register") return <p className="mt-6 text-center text-xs text-slate-500">Already have an account? <Link href="/auth/login" className="text-indigo-300 hover:text-indigo-200">Sign in</Link></p>;
  return <p className="mt-6 text-center text-xs text-slate-500"><Link href="/auth/login" className="text-indigo-300 hover:text-indigo-200">Back to sign in</Link></p>;
}