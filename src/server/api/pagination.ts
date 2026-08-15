import { ApiError } from "@/src/server/api/errors";

export type PaginationInput = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function getPagination(searchParams: URLSearchParams): PaginationInput {
  const rawPage = searchParams.get("page");
  const rawPageSize = searchParams.get("pageSize");

  const page = rawPage ? Number(rawPage) : 1;
  const pageSize = rawPageSize ? Number(rawPageSize) : 20;

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(422, "VALIDATION_ERROR", "page must be an integer >= 1");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiError(422, "VALIDATION_ERROR", "pageSize must be an integer between 1 and 100");
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function toPageMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
