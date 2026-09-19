"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ApiClientError, apiClient } from "@/src/lib/api-client";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

export type AuthUser = {
  id: string;
  email: string;
  status: string;
};

export type Membership = {
  id: string;
  status: string;
  role: {
    id: string;
    name: string;
    description?: string | null;
    permissions?: Array<{ permission: { key: string } }>;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    status: string;
    logoUrl?: string | null;
  };
};

export type AuthMeResponse = {
  data: {
    user: AuthUser;
    profile: Record<string, unknown> | null;
    memberships: Membership[];
  };
};

export type AuthState =
  | { status: "loading"; user: null; profile: null; memberships: []; session: Session | null; error: null }
  | { status: "authenticated"; user: AuthUser; profile: Record<string, unknown> | null; memberships: Membership[]; session: Session; error: null }
  | { status: "unauthenticated"; user: null; profile: null; memberships: []; session: null; error: null }
  | { status: "error"; user: null; profile: null; memberships: []; session: Session | null; error: Error };

type AuthContextValue = AuthState & { refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null, profile: null, memberships: [], session: null, error: null });

  const loadApplicationUser = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ status: "unauthenticated", user: null, profile: null, memberships: [], session: null, error: null });
      return;
    }

    setState({ status: "loading", user: null, profile: null, memberships: [], session, error: null });
    try {
      const response = await apiClient.get<AuthMeResponse>("/auth/me");
      setState({ status: "authenticated", user: response.data.user, profile: response.data.profile, memberships: response.data.memberships, session, error: null });
    } catch (error) {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
        setState({ status: "unauthenticated", user: null, profile: null, memberships: [], session: null, error: null });
      } else {
        setState({ status: "error", user: null, profile: null, memberships: [], session, error: error instanceof Error ? error : new Error("Unable to load your application account") });
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    await loadApplicationUser(data.session);
  }, [loadApplicationUser]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const timer = window.setTimeout(() => void refresh(), 0);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadApplicationUser(session);
    });
    return () => {
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [loadApplicationUser, refresh]);

  const signOut = useCallback(async () => {
    await getSupabaseBrowserClient().auth.signOut();
  }, []);

  const value = useMemo(() => ({ ...state, refresh, signOut }), [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}