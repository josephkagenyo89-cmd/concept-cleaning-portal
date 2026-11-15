import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin, Satellite } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ServiceLocationValue } from '@/lib/serviceLocation';

declare global {
  interface Window {
    google?: any;
  }
}

const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
let mapsLoader: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!key) return Promise.reject(new Error('Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to the project environment.'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ccs-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps could not be loaded.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.ccsGoogleMaps = 'true';
    script.async = true;
    script.defer = true;
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly&loading=async';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google Maps could not be loaded. Check the API key and enabled APIs.'));
    document.head.appendChild(script);
  }).catch((error) => {
    mapsLoader = null;
    throw error;
  });

  return mapsLoader;
}

const emptyLocation = (): ServiceLocationValue => ({
  address: '',
  propertyName: '',
  latitude: null,
  longitude: null,
  entrance: '',
  directions: '',
});

function readPoint(point: any) {
  const latitude = typeof point?.lat === 'function' ? point.lat() : point?.lat;
  const longitude = typeof point?.lng === 'function' ? point.lng() : point?.lng;
  return { lat: Number(latitude), lng: Number(longitude) };
}

export default function ServiceLocationPicker({
  value,
  onChange,
}: {
  value: ServiceLocationValue | null;
  onChange: (value: ServiceLocationValue) => void;
}) {
  const searchRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [draft, setDraft] = useState<ServiceLocationValue>(value || emptyLocation());
  const draftRef = useRef<ServiceLocationValue>(value || emptyLocation());
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (value) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value]);

  const publish = useCallback((next: ServiceLocationValue) => {
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  }, [onChange]);

  const reverseGeocode = useCallback(async (point: { lat: number; lng: number }) => {
    const current = draftRef.current;
    let address = current.address;
    try {
      const response = await geocoderRef.current?.geocode({ location: point });
      address = response?.results?.[0]?.formatted_address || address;
    } catch {
      // Coordinates remain valid even when reverse geocoding has no result.
    }
    publish({ ...current, address, latitude: point.lat, longitude: point.lng });
  }, [publish]);

  useEffect(() => {
    let active = true;
    let autocomplete: any;
    let selectHandler: any;
    let mapClickListener: any;

    const initialize = async () => {
      setLoading(true);
      setError('');
      try {
        const google = await loadGoogleMaps();
        if (!active || !searchRef.current || !mapRef.current) return;

        const [{ Map }, { AdvancedMarkerElement }, { PlaceAutocompleteElement }, { Geocoder }] = await Promise.all([
          google.maps.importLibrary('maps'),
          google.maps.importLibrary('marker'),
          google.maps.importLibrary('places'),
          google.maps.importLibrary('geocoding'),
        ]);

        if (!active || !searchRef.current || !mapRef.current) return;

        const mapId = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || 'DEMO_MAP_ID';
        const map = new Map(mapRef.current, {
          center: draft.latitude != null && draft.longitude != null
            ? { lat: draft.latitude, lng: draft.longitude }
            : NAIROBI_CENTER,
          zoom: draft.latitude != null && draft.longitude != null ? 18 : 12,
          mapId,
          mapTypeControl: true,
          mapTypeId: 'roadmap',
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });
        mapInstance.current = map;
        geocoderRef.current = new Geocoder();

        const marker = new AdvancedMarkerElement({
          map,
          position: draft.latitude != null && draft.longitude != null
            ? { lat: draft.latitude, lng: draft.longitude }
            : null,
          title: 'Exact service location — drag to adjust',
          gmpDraggable: true,
        });
        markerRef.current = marker;

        marker.addEventListener('gmp-dragend', () => {
          const point = readPoint(marker.position);
          if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
            void reverseGeocode(point);
          }
        });

        mapClickListener = map.addListener('click', (event: any) => {
          if (!event.latLng) return;
          const point = readPoint(event.latLng);
          marker.position = point;
          void reverseGeocode(point);
        });

        autocomplete = new PlaceAutocompleteElement({ includedRegionCodes: ['ke'] });
        autocomplete.placeholder = 'Search building, apartment, estate, road or landmark';
        autocomplete.style.width = '100%';
        autocomplete.style.display = 'block';
        autocomplete.style.fontSize = '16px';
        searchRef.current.replaceChildren(autocomplete);

        selectHandler = async (event: any) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({
              fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
            });
            if (!place.location) return;
            const point = readPoint(place.location);
            marker.position = point;
            map.panTo(point);
            map.setZoom(18);
            publish({
              ...draftRef.current,
              propertyName: place.displayName || draftRef.current.propertyName,
              address: place.formattedAddress || place.displayName || '',
              latitude: point.lat,
              longitude: point.lng,
            });
          } catch {
            setError('We could not load that place. Try another search or adjust the map pin.');
          }
        };
        autocomplete.addEventListener('gmp-select', selectHandler);

        if (draft.latitude != null && draft.longitude != null) {
          marker.position = { lat: draft.latitude, lng: draft.longitude };
        }
      } catch (loadError: any) {
        if (active) setError(loadError?.message || 'Map could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void initialize();

    return () => {
      active = false;
      if (autocomplete && selectHandler) autocomplete.removeEventListener('gmp-select', selectHandler);
      if (mapClickListener) window.google?.maps?.event?.removeListener(mapClickListener);
      if (markerRef.current) markerRef.current.map = null;
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location detection. Search for your property instead.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (markerRef.current) markerRef.current.position = point;
        mapInstance.current?.panTo(point);
        mapInstance.current?.setZoom(18);
        await reverseGeocode(point);
        setLocating(false);
      },
      () => {
        setError('Location permission was not granted. Search for your property or move the map pin manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const selected = draft.latitude != null && draft.longitude != null && Boolean(draft.address.trim());

  return (
    <div className="space-y-3 md:col-span-2">
      <div>
        <Label className="text-sm font-bold">Where should our team go?</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Search for the property, choose a result, then move the pin to the exact building or entrance.
        </p>
      </div>

      <div ref={searchRef} className="min-h-12 w-full [&>gmp-place-autocomplete]:w-full" />

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
          {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <p className="mt-1 text-xs">The map will become available after the Google Maps key is configured for this deployment.</p>
          )}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <div ref={mapRef} className="h-[280px] w-full sm:h-[340px]" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/85">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading map…</span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => mapInstance.current?.setMapTypeId('roadmap')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-slate-800 shadow">
            <MapPin className="h-3.5 w-3.5" /> Map
          </button>
          <button type="button" onClick={() => mapInstance.current?.setMapTypeId('hybrid')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-slate-800 shadow">
            <Satellite className="h-3.5 w-3.5" /> Satellite
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {selected ? 'Pin selected: ' + draft.latitude?.toFixed(6) + ', ' + draft.longitude?.toFixed(6) : 'No exact pin selected yet.'}
        </p>
        <button type="button" onClick={locateMe} disabled={locating || loading} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          Use my current location
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <Label>Building / property name</Label>
          <Input value={draft.propertyName} onChange={(event) => publish({ ...draft, propertyName: event.target.value })} placeholder="e.g. Spirittan Apartments" maxLength={120} />
        </label>
        <label className="space-y-1.5">
          <Label>Entrance / access point</Label>
          <Input value={draft.entrance} onChange={(event) => publish({ ...draft, entrance: event.target.value })} placeholder="e.g. Main gate, Block B" maxLength={160} />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <Label>Directions for our team (optional)</Label>
          <Input value={draft.directions} onChange={(event) => publish({ ...draft, directions: event.target.value })} placeholder="e.g. Opposite the supermarket; call when at the gate" maxLength={300} />
        </label>
      </div>

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
        We use the confirmed pin and your access instructions to help our team find the property. Our team will confirm service coverage and appointment availability after reviewing your request.
      </div>
    </div>
  );
}
