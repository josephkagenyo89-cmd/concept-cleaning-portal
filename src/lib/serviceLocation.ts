export interface ServiceLocationValue {
  address: string;
  propertyName: string;
  latitude: number | null;
  longitude: number | null;
  entrance: string;
  directions: string;
}

export interface ParsedServiceLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

const GPS_SUFFIX = /\s*\[CCS_GPS:([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)\]\s*$/i;

export function parseServiceLocation(raw: string | null | undefined): ParsedServiceLocation {
  const value = String(raw || '').trim();
  const match = value.match(GPS_SUFFIX);
  if (!match) return { address: value, latitude: null, longitude: null };

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

  return {
    address: value.replace(GPS_SUFFIX, '').trim(),
    latitude: valid ? latitude : null,
    longitude: valid ? longitude : null,
  };
}

export function serializeServiceLocation(value: ServiceLocationValue | null | undefined): string {
  if (!value) return '';
  const address = value.address.trim();
  const property = value.propertyName.trim();
  const label = property && !address.toLowerCase().includes(property.toLowerCase())
    ? property + ', ' + address
    : address;

  if (
    value.latitude == null || value.longitude == null ||
    !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) ||
    value.latitude < -90 || value.latitude > 90 ||
    value.longitude < -180 || value.longitude > 180
  ) return label;

  // Keep coordinates in the existing text field until a separately approved
  // database migration adds normalized latitude/longitude columns.
  return label + ' [CCS_GPS:' + value.latitude.toFixed(6) + ',' + value.longitude.toFixed(6) + ']';
}

export function serviceLocationMapUrl(raw: string | null | undefined): string {
  const parsed = parseServiceLocation(raw);
  const query = parsed.latitude != null && parsed.longitude != null
    ? parsed.latitude + ',' + parsed.longitude
    : parsed.address;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

export function serviceLocationNotes(
  value: ServiceLocationValue | null | undefined,
  existingNotes = '',
): string | null {
  if (!value) return existingNotes.trim() || null;
  const notes = [
    existingNotes.trim(),
    value.entrance.trim() ? 'Entrance / access point: ' + value.entrance.trim() : '',
    value.directions.trim() ? 'Additional directions: ' + value.directions.trim() : '',
  ].filter(Boolean);
  return notes.join('\n') || null;
}

export function serviceLocationFromSearchParams(params: URLSearchParams): ServiceLocationValue | null {
  const address = params.get('location') || '';
  const latitudeText = params.get('lat');
  const longitudeText = params.get('lng');
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!address || latitudeText == null || longitudeText == null || latitudeText === '' || longitudeText === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    address,
    propertyName: params.get('property') || '',
    latitude,
    longitude,
    entrance: params.get('entrance') || '',
    directions: params.get('directions') || '',
  };
}
