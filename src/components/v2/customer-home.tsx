"use client";

import Link from "next/link";
import { useAuth } from "@/src/hooks/use-auth";
import { useTenant } from "@/src/hooks/use-tenant";

const categories = [
  { label: "Beauty & wellness", note: "Find your next ritual" },
  { label: "Home services", note: "Make space for what matters" },
  { label: "Fitness & movement", note: "Keep your rhythm" },
  { label: "Events & occasions", note: "Bring the details together" },
];

export function CustomerHome() {
  const auth = useAuth();
  const tenant = useTenant();
  const firstName = auth.status === "authenticated" ? auth.user.firstName || auth.user.email.split("@")[0] : null;

  return (
    <div className="customer-home">
      <section className="customer-hero">
        <div className="customer-hero-copy">
          <p className="eyebrow">The service hub for everyday life</p>
          <h1>Find the people who make your day better.</h1>
          <p className="hero-lede">Discover trusted service businesses, keep your plans in one place, and make room for the work that matters to you.</p>
          <div className="hero-actions">
            <Link href={auth.status === "authenticated" ? "/businesses" : "/auth/login"} className="primary-button">Explore services <span aria-hidden="true">↗</span></Link>
            <Link href={auth.status === "authenticated" ? "/dashboard/onboarding" : "/auth/register"} className="quiet-link">Start your business <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-core"><span>mirr</span><small>service hub</small></div>
          <div className="orbit-tag orbit-tag-one">Book with ease</div>
          <div className="orbit-tag orbit-tag-two">Made for real life</div>
        </div>
      </section>

      {auth.status === "authenticated" ? (
        <section className="customer-welcome glass">
          <div>
            <p className="eyebrow">Your space</p>
            <h2>Good to see you, {firstName}.</h2>
            <p>{tenant.memberships.length ? `You have access to ${tenant.memberships.length} business workspace${tenant.memberships.length === 1 ? "" : "s"}.` : "You are set up as a customer. Your business journey starts whenever you are ready."}</p>
          </div>
          <div className="welcome-actions">
            <Link href="/account" className="secondary-button">View profile</Link>
            {tenant.memberships.length ? <Link href="/dashboard" className="primary-button">Open business</Link> : <Link href="/dashboard/onboarding" className="primary-button">Start your business</Link>}
          </div>
        </section>
      ) : null}

      <section className="discovery-panel glass">
        <div className="section-heading">
          <div><p className="eyebrow">Discover</p><h2>What are you looking for?</h2></div>
          <span className="availability-note">Discovery catalog coming online</span>
        </div>
        <div className="search-bar" aria-label="Service discovery preview">
          <span aria-hidden="true">⌕</span>
          <span>Search services, businesses, or neighborhoods</span>
          <span className="search-lock">Soon</span>
        </div>
        <div className="category-grid">
          {categories.map((category) => <div key={category.label} className="category-tile"><span className="category-dot" /><div><h3>{category.label}</h3><p>{category.note}</p></div><span aria-hidden="true">↗</span></div>)}
        </div>
        <p className="contract-note">Public discovery and booking endpoints are not part of the current API contract yet. This experience is ready for those verified feeds without inventing catalog data.</p>
      </section>

      <section className="split-promo">
        <div className="promo-block promo-dark"><p className="eyebrow">For customers</p><h2>Your plans, without the chase.</h2><p>Keep your account details close and your future service history ready when customer-self routes arrive.</p><Link href={auth.status === "authenticated" ? "/account" : "/auth/register"} className="quiet-link">{auth.status === "authenticated" ? "Open account" : "Create your account"} <span aria-hidden="true">→</span></Link></div>
        <div className="promo-block promo-light"><p className="eyebrow">For businesses</p><h2>Make your work easier to find.</h2><p>Build a real business workspace with services, staff, locations, hours, and customer operations.</p><Link href={auth.status === "authenticated" ? "/dashboard/onboarding" : "/auth/register"} className="dark-link">Start your business <span aria-hidden="true">→</span></Link></div>
      </section>
    </div>
  );
}
