import { convertToParamMap } from '@angular/router';

import {
  readDateParam,
  readOptionParam,
  readPageParam,
  readPageSizeParam,
  readTextParam,
  toHttpParams,
  toQueryParams,
} from './list-query.utils';

describe('list query utils', () => {
  it('builds HttpParams leaving out empty values', () => {
    const params = toHttpParams({ q: 'ana', status: '', staffProfileId: null, from: undefined, page: 2, active: false });
    expect(params.keys()).toEqual(['q', 'page', 'active']);
    expect(params.get('page')).toBe('2');
    expect(params.get('active')).toBe('false');
  });

  it('reads the page and the page size from the URL, ignoring invalid values', () => {
    expect(readPageParam(convertToParamMap({ page: '3' }))).toBe(3);
    expect(readPageParam(convertToParamMap({ page: '0' }))).toBe(1);
    expect(readPageParam(convertToParamMap({ page: 'abc' }))).toBe(1);
    expect(readPageParam(convertToParamMap({ movementPage: '2' }), 'movementPage')).toBe(2);
    expect(readPageSizeParam(convertToParamMap({ pageSize: '50' }))).toBe(50);
    expect(readPageSizeParam(convertToParamMap({ pageSize: '500' }))).toBe(25);
    expect(readPageSizeParam(convertToParamMap({}))).toBe(25);
  });

  it('accepts only known options and well-formed dates', () => {
    const params = convertToParamMap({ status: 'Active', kind: 'Hacked', from: '2026-11-06', to: '6/11/2026', q: 'x' });
    expect(readOptionParam(params, 'status', ['Active', 'Inactive'])).toBe('Active');
    expect(readOptionParam(params, 'kind', ['Service'])).toBe('');
    expect(readDateParam(params, 'from')).toBe('2026-11-06');
    expect(readDateParam(params, 'to')).toBe('');
    expect(readTextParam(params, 'q')).toBe('x');
    expect(readTextParam(params, 'missing')).toBe('');
  });

  it('turns empty values and the default page into removals so URLs stay short', () => {
    expect(toQueryParams({ q: '', status: 'Active', page: 1, pageSize: 25, from: undefined })).toEqual({
      q: null,
      status: 'Active',
      page: null,
      pageSize: null,
      from: null,
    });
    expect(toQueryParams({ page: 4, pageSize: 50 })).toEqual({ page: 4, pageSize: 50 });
  });
});
