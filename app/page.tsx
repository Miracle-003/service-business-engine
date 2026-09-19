import Link from "next/link";

const workflows = [
  ["Businesses", "/businesses", "Manage tenants, locations, hours, holidays, and settings."],
  ["Services", "/services", "Build the catalog your customers can book."],
  ["Bookings", "/bookings", "Track appointments and their status history."],
  ["Customers", "/customers", "Keep customer records and contact details together."],
];

const steps = [
  ["01", "Set up", "Create a business and its operating details."],
  ["02", "Organize", "Add services, staff, and customers."],
  ["03", "Operate", "Manage bookings, quotes, and reviews."],
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <section className="grid gap-8 rounded-3xl border border-indigo-300/15 bg-indigo-400/8 p-7 shadow-2xl shadow-indigo-950/20 sm:p-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">Service business operations</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">Run the work behind every appointment.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">ServiceOS brings businesses, services, staff, customers, bookings, quotes, and reviews into one workspace.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/businesses" className="primary-button">Open businesses</Link>
            <Link href="/auth/login" className="secondary-button">Sign in</Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {steps.map(([number, title, description]) => (
            <div key={number} className="border-l border-indigo-300/25 pl-4">
              <p className="text-xs font-semibold text-indigo-300">{number}</p>
              <p className="mt-1 font-medium text-white">{title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Start with a core workflow</h2>
          </div>
          <Link href="/admin" className="text-sm text-indigo-300 transition hover:text-white">Admin tools</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {workflows.map(([title, href, description]) => (
            <Link key={href} href={href} className="glass rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-indigo-300/25">
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              <span className="mt-5 block text-sm font-medium text-indigo-300">View {title.toLowerCase()} -&gt;</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
