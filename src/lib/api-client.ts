import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser";

export type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorShape) {
    super(body.error?.message ?? `Request failed with status ${status}`);
    this.name = "ApiClientError";
    this.status = status;
    this.code = body.error?.code;
    this.details = body.error?.details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const accessToken = data.session?.access_token;

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    credentials: "include",
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorShape;
  if (!response.ok) {
    throw new ApiClientError(response.status, body);
  }

  return body;
}

export const apiClient = {
  get<T>(path: string, options?: RequestInit) {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body: unknown, options?: RequestInit) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  patch<T>(path: string, body: unknown, options?: RequestInit) {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  put<T>(path: string, body: unknown, options?: RequestInit) {
    return request<T>(path, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  delete<T>(path: string, options?: RequestInit) {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};