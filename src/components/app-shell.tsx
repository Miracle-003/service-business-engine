"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/hooks/use-auth";
import { useTenant } from "@/src/hooks/use-tenant";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/src/components/ui/states";
import { ThemeToggle } from "@/src/components/theme-toggle";
import { useEffect, useState } from "react";

const navigation = [
  { label: "Overview", href: "/" },
  { label: "Businesses", href: "/businesses" },
  { label: "Services", href: "/services" },
  { label: "Staff", href: "/staff" },
  { label: "Customers", href: "/customers" },
  { label: "Bookings", href: "/bookings" },
  { label: "Quotes", href: "/quotes" },
];

function Mark() {
  return <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/15 text-sm font-bold text-indigo-200 ring-1 ring-indigo-300/20">SB</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authPage = pathname.startsWith("/auth");
  const protectedPage = pathname !== "/" && !authPage;

  useEffect(() => {
    if (protectedPage && auth.status === "unauthenticated") {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [auth.status, pathname, protectedPage, router]);

  if (authPage) return <main className="min-h-screen">{children}</main>;
  if (protectedPage && auth.status === "loading") return <main className="min-h-screen p-5 sm:p-10"><LoadingState label="Verifying your session" /></main>;
  if (protectedPage && auth.status === "error") return <main className="mx-auto min-h-screen max-w-xl p-5 pt-24 sm:p-10"><ErrorState title="Unable to verify your session" description={auth.error.message} onRetry={auth.refresh} /></main>;
  if (protectedPage && auth.status === "unauthenticated") return <main className="min-h-screen" />;

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <aside className="hidden w-64 shrink-0 border-r border-white/8 bg-slate-950/25 px-4 py-6 lg:flex lg:flex-col">
        <Link href="/" className="mb-10 flex items-center gap-3 px-3">
          <Mark />
          <span className="text-sm font-semibold tracking-wide text-white">ServiceOS</span>
        </Link>
        <Navigation pathname={pathname} vertical />
        <BusinessSelector />
        <div className="mt-auto px-3">
          <AuthSummary auth={auth} />
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/8 bg-[#080b14]/70 px-5 backdrop-blur-xl sm:px-8 lg:hidden">
          <div className="flex items-center gap-3"><button type="button" className="icon-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}>☰</button><Link href="/" className="flex items-center gap-3"><Mark /><span className="text-sm font-semibold text-white">ServiceOS</span></Link></div>
          <div className="flex items-center gap-2"><ThemeToggle /><AuthSummary auth={auth} compact /></div>
        </header>
        {mobileMenuOpen ? <div className="fixed inset-0 z-30 bg-black/55 lg:hidden" onClick={() => setMobileMenuOpen(false)}><aside className="h-full w-[min(19rem,86vw)] border-r border-white/10 bg-[#0d1220] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-8 flex items-center justify-between"><Link href="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}><Mark /><span className="text-sm font-semibold text-white">ServiceOS</span></Link><button type="button" className="icon-button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}>×</button></div><Navigation pathname={pathname} vertical onNavigate={() => setMobileMenuOpen(false)} /><BusinessSelector /></aside></div> : null}
        <div className="soft-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex-1 px-5 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12"><div className="mb-6 hidden justify-end lg:flex"><ThemeToggle /></div>{children}</div>
        <div className="relative border-t border-white/8 px-5 py-4 lg:hidden">
          <Navigation pathname={pathname} />
        </div>
      </main>
    </div>
  );
}

function Navigation({ pathname, vertical = false, onNavigate }: { pathname: string; vertical?: boolean; onNavigate?: () => void }) {
  return (
    <nav className={vertical ? "space-y-1" : "flex gap-2 overflow-x-auto pb-1"}>
      {navigation.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} onClick={onNavigate} className={`${vertical ? "flex w-full" : "shrink-0"} items-center rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-indigo-400/12 font-medium text-indigo-100 ring-1 ring-indigo-300/15" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>{item.label}</Link>;
      })}
    </nav>
  );
}

function AuthSummary({ auth, compact = false }: { auth: ReturnType<typeof useAuth>; compact?: boolean }) {
  if (auth.status === "loading") return <span className="text-xs text-slate-500">Checking session…</span>;
  if (auth.status === "authenticated") return <div className="flex items-center gap-2"><StatusBadge status="active" tone="success" />{!compact ? <span className="truncate text-xs text-slate-400">{auth.user.email}</span> : null}<button type="button" className="text-xs text-slate-500 transition hover:text-white" onClick={() => void auth.signOut()}>Sign out</button></div>;
  return <span className="text-xs text-slate-500">Not signed in</span>;
}

function BusinessSelector() {
  const { memberships, activeMembership, selectBusiness } = useTenant();
  if (!memberships.length) return null;
  return <div className="mt-8 border-t border-white/8 px-3 pt-5"><label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="active-business">Active business</label><select id="active-business" value={activeMembership?.business.id ?? ""} onChange={(event) => selectBusiness(event.target.value)} className="field w-full text-xs"><option value="" disabled>Select business</option>{memberships.map((membership) => <option key={membership.business.id} value={membership.business.id}>{membership.business.name}</option>)}</select><p className="mt-2 truncate text-[11px] text-slate-500">{activeMembership?.role.name}</p></div>;
}