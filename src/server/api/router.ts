import { ApiError } from "@/src/server/api/errors";

export type RouteMatch = {
  params: Record<string, string>;
};

export type RouteHandler<TContext> = (args: {
  request: Request;
  context: TContext;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}) => Promise<Response>;

export type RouteDefinition<TContext> = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  pattern: string;
  handler: RouteHandler<TContext>;
};

function normalizePath(path: string): string[] {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function matchPattern(pattern: string, path: string): RouteMatch | null {
  const patternParts = normalizePath(pattern);
  const pathParts = normalizePath(path);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":") && patternPart.endsWith("*")) {
      const key = patternPart.slice(1, -1);
      params[key] = pathParts.slice(i).join("/");
      return { params };
    }

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = pathPart;
      continue;
    }

    if (patternPart !== pathPart) {
      return null;
    }
  }

  return { params };
}

export async function dispatchRoute<TContext>(
  method: string,
  path: string,
  routes: RouteDefinition<TContext>[],
  args: {
    request: Request;
    context: TContext;
    searchParams: URLSearchParams;
  },
) {
  const route = routes.find((candidate) => {
    if (candidate.method !== method) {
      return false;
    }

    return Boolean(matchPattern(candidate.pattern, path));
  });

  if (!route) {
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found");
  }

  const match = matchPattern(route.pattern, path);
  if (!match) {
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found");
  }

  return route.handler({
    request: args.request,
    context: args.context,
    params: match.params,
    searchParams: args.searchParams,
  });
}
