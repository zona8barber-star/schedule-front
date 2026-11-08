/**
 * One page of a server-side paginated list (ADR-0016 B7). `page` starts at 1 and `totalCount` counts every row that
 * matches the filters, so the number of pages is `ceil(totalCount / pageSize)`.
 */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Same limits as the API: `pageSize` between 1 and 100, 25 when omitted. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Page parameters accepted by every paginated list. */
export interface PageQuery {
  page?: number | null;
  pageSize?: number | null;
}

export function emptyPage<T>(pageSize = DEFAULT_PAGE_SIZE): PagedResult<T> {
  return { items: [], page: 1, pageSize, totalCount: 0 };
}
