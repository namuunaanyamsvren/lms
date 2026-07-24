import { ApiResponse, PaginatedResponse } from '../types';

export const formatResponse = <T>(data: T, message?: string): ApiResponse<T> => {
  return {
    success: true,
    message,
    data,
  };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<PaginatedResponse<T>> => {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data: {
      data,
      total,
      page,
      limit,
      totalPages,
    },
  };
};
