import { prisma } from "@/src/lib/prisma";
import { ApiError } from "@/src/server/api/errors";

export type AuthContext = {
  authUserId: string;
  appUser: {
    id: string;
    email: string;
    status: string;
  };
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "Supabase environment variables are missing");
  }

  return { url, anonKey };
}

function parseBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) {
    throw new ApiError(401, "UNAUTHENTICATED", "Missing Authorization header");
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid Authorization header format");
  }

  return token;
}

async function getSupabaseAuthUser(token: string): Promise<{ id: string; email?: string | null }> {
  const { url, anonKey } = getSupabaseEnv();

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired access token");
  }

  const data = (await response.json()) as { id?: string; email?: string | null };
  if (!data.id) {
    throw new ApiError(401, "UNAUTHENTICATED", "Unable to resolve authenticated user");
  }

  return { id: data.id, email: data.email };
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const token = parseBearerToken(request);
  const authUser = await getSupabaseAuthUser(token);

  const appUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, status: true },
  });

  if (!appUser) {
    throw new ApiError(403, "USER_NOT_PROVISIONED", "Authenticated user is not provisioned in the application database");
  }

  return {
    authUserId: authUser.id,
    appUser,
  };
}
