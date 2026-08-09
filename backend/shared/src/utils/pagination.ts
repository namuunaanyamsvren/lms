import type { Request } from 'express';

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

export function getPagination(req: Request, options: { defaultLimit?: number; maxLimit?: number } = {}): Pagination {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedData<T>(items: T[], total: number, pagination: Pagination) {
  return {
    items,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  };
}
