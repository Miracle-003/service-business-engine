"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Membership } from "@/src/hooks/use-auth";
import { useAuth } from "@/src/hooks/use-auth";

type TenantContextValue = {
  memberships: Membership[];
  activeMembership: Membership | null;
  businessId: string | null;
  selectBusiness: (businessId: string) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { memberships } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("serviceos.activeBusinessId");
      if (stored) setSelectedId(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const activeMembership = memberships.find((membership) => membership.business.id === selectedId) ?? memberships[0] ?? null;
  const value = useMemo(
    () => ({
      memberships,
      activeMembership,
      businessId: activeMembership?.business.id ?? null,
      selectBusiness: (businessId: string) => {
        window.localStorage.setItem("serviceos.activeBusinessId", businessId);
        setSelectedId(businessId);
      },
    }),
    [activeMembership, memberships],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
}