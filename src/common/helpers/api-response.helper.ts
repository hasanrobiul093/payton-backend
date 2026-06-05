/**
 * Standard API Response Interface
 * All responses (success & error) share this shape:
 * { statusCode, message, meta, data, timestamp }
 */
export interface ApiResponse<T = unknown> {
  statusCode: number;
  message: string;
  meta: PaginationMeta | null;
  data: T | null;
  timestamp: string;
}

/**
 * Pagination meta — include when returning a paginated list
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Build a standard success response object.
 *
 * @param statusCode  HTTP status code (e.g. 200, 201)
 * @param message     Human-readable success message
 * @param data        Response payload
 * @param meta        Optional pagination metadata
 */
export function sendResponse<T>(
  statusCode: number,
  message: string,
  data: T | null = null,
  meta: PaginationMeta | null = null,
): ApiResponse<T> {
  return {
    statusCode,
    message,
    meta,
    data,
    timestamp: new Date().toISOString(),
  };
}
