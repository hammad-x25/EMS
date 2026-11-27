export interface PaginationParams {
  enabled: boolean;
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? 25;
  const maxLimit = options.maxLimit ?? 100;
  const hasPage = searchParams.has("page");
  const hasLimit = searchParams.has("limit");
  const enabled = hasPage || hasLimit;

  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawLimit = Number(searchParams.get("limit") ?? String(defaultLimit));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), maxLimit)
    : defaultLimit;

  return {
    enabled,
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const safeTotal = Math.max(0, total);
  return {
    page: Math.max(1, page),
    limit: safeLimit,
    total: safeTotal,
    totalPages: Math.max(1, Math.ceil(safeTotal / safeLimit)),
  };
}
