import { describe, expect, it } from 'vitest';
import { buildCustomerAuthRedirectUrl, safeNext } from './CustomerAuth';

describe('customer auth redirect preservation', () => {
  it('keeps a valid service route as the return target', () => {
    expect(safeNext('/service/full-detailing-package?mode=quote')).toBe('/service/full-detailing-package?mode=quote');
    expect(buildCustomerAuthRedirectUrl('/service/full-detailing-package?mode=quote')).toContain(
      '/customer-auth?next=' + encodeURIComponent('/service/full-detailing-package?mode=quote')
    );
  });

  it('falls back safely when the next target is invalid', () => {
    expect(safeNext('https://evil.example')).toBe('/my');
    expect(safeNext('//evil.example')).toBe('/my');
    expect(buildCustomerAuthRedirectUrl('https://evil.example')).toContain('/customer-auth?next=' + encodeURIComponent('/my'));
  });
});
