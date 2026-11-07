import { HttpParams } from '@angular/common/http';
import { ParamMap } from '@angular/router';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../models/paged-result.models';

export type QueryValue = string | number | boolean | null | undefined;

/** Builds HttpParams from an object, leaving out empty values (null, undefined and ''). */
export function toHttpParams(values: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}

/** Page number from the URL: a positive integer, 1 otherwise. */
export function readPageParam(params: ParamMap, key = 'page'): number {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

/** Page size from the URL, limited to what the API accepts; the default otherwise. */
export function readPageSizeParam(params: ParamMap, fallback = DEFAULT_PAGE_SIZE, key = 'pageSize'): number {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE_SIZE ? value : fallback;
}

/** Text filter from the URL ('' when missing). */
export function readTextParam(params: ParamMap, key: string): string {
  return params.get(key) ?? '';
}

/** One of the allowed values ('' when missing or unknown), so a hand-edited URL never reaches the API. */
export function readOptionParam<T extends string>(params: ParamMap, key: string, allowed: readonly T[]): T | '' {
  const value = params.get(key);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

/** A yyyy-MM-dd date from the URL ('' when missing or malformed). */
export function readDateParam(params: ParamMap, key: string): string {
  const value = params.get(key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/**
 * Query params for `Router.navigate` with `queryParamsHandling: 'merge'`: empty values become null so they are removed
 * from the URL, and the default page and page size are left out to keep URLs short.
 */
export function toQueryParams(values: Record<string, QueryValue>): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(values)) {
    const isDefault = (key === 'page' && value === 1) || (key === 'pageSize' && value === DEFAULT_PAGE_SIZE);
    result[key] = value === undefined || value === '' || isDefault ? null : value;
  }
  return result;
}
