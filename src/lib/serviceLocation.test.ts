import { describe, expect, it } from 'vitest';
import { parseServiceLocation, serializeServiceLocation, serviceLocationMapUrl } from './serviceLocation';

describe('service location serialization', () => {
  it('preserves a building address and exact coordinates', () => {
    const stored = serializeServiceLocation({
      address: 'Pipeline, Embakasi, Nairobi, Kenya',
      propertyName: 'Spirittan Apartments',
      latitude: -1.31842,
      longitude: 36.89521,
      entrance: 'Main gate',
      directions: '',
    });
    expect(stored).toContain('Spirittan Apartments');
    expect(parseServiceLocation(stored)).toEqual({
      address: 'Spirittan Apartments, Pipeline, Embakasi, Nairobi, Kenya',
      latitude: -1.31842,
      longitude: 36.89521,
    });
  });

  it('keeps legacy text locations readable', () => {
    expect(parseServiceLocation('Pipeline, Embakasi').latitude).toBeNull();
    expect(parseServiceLocation('Pipeline, Embakasi').address).toBe('Pipeline, Embakasi');
  });

  it('builds a coordinate-based Google Maps link when a pin exists', () => {
    const url = serviceLocationMapUrl('Pipeline [CCS_GPS:-1.3,36.8]');
    expect(url).toContain(encodeURIComponent('-1.3,36.8'));
  });
});
