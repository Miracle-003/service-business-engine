import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/src/components/app-shell";
import { AuthProvider } from "@/src/hooks/use-auth";
import { TenantProvider } from "@/src/hooks/use-tenant";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ServiceOS",
  description: "Multi-tenant service business platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>
          <TenantProvider>
            <AppShell>{children}</AppShell>
          </TenantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
