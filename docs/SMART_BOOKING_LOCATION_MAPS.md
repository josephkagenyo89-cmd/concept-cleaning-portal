# Uber-style service location selection

Status: frontend implementation in progress; preview only.

## Customer experience

- Search for a building, apartment, estate, road or landmark using Google Places Autocomplete, restricted to Kenya.
- Show the selected place on an interactive Google Map.
- Let the customer drag the marker or tap the map to refine the exact building/entrance.
- Provide roadmap and satellite/hybrid map modes.
- Offer browser current-location detection only after the customer chooses it; manual search remains available.
- Capture building/property name, entrance/access point and optional directions.
- Require a confirmed pin before submitting a booking or quotation request.
- Explain that Concept staff confirm service coverage and availability after reviewing the request.

## ERP experience

- Guest Requests displays the human-readable address and a link that opens the exact coordinates in Google Maps.
- Booking Details parses the exact pin and uses it before falling back to the typed address.
- Staff can use the existing Google Maps navigation link; no parallel navigation module is introduced.

## Persistence without a database migration

The current generated Supabase types do not contain a dedicated GPS coordinate field on guest_service_requests or bookings. The current task must not change Supabase schema or production data.

Until a separately approved migration is made, the selected address is stored in the existing text location field with a machine-readable suffix:

    [CCS_GPS:latitude,longitude]

The admin UI strips this suffix for display and extracts the coordinates for map navigation. Entrance and access directions are saved in the existing customer notes field. This is a compatibility bridge, not the final normalized data model.

## Required Google Cloud configuration

Add these environment variables to local development and Vercel Preview before testing the live map:

- VITE_GOOGLE_MAPS_API_KEY — browser key, restricted by HTTP referrer and API.
- VITE_GOOGLE_MAPS_MAP_ID — optional Google Map ID; if omitted the component uses Google's demo map ID.

Enable billing and these APIs in the Google Cloud project:

- Maps JavaScript API
- Places API (New)
- Geocoding API

Restrict the browser key to the required website origins and only the APIs above. Never use a server-side secret key in a VITE_* variable. The key is visible in browser code by design, so API and referrer restrictions are essential.

## Known limitations / follow-up

- The map is unavailable until the browser key is configured. The UI reports this rather than pretending a pin was selected.
- Current service coverage includes Nairobi, Kiambu and parts of Kajiado and Machakos, but the project has no approved service-area polygons. Do not invent a geographic boundary or reject valid requests based on an approximate county label. Staff must confirm coverage until official service-area polygons are approved.
- The coordinate suffix keeps the existing workflows working without a migration. A future approved migration should add normalized latitude/longitude and structured property/access fields to the relevant request and booking records, update RPC conversion, and regenerate Supabase types.
- Test real search results for estates and buildings in Pipeline/Embakasi, pin dragging, map taps, satellite mode, current-location permission, guest submission, authenticated handoff, and admin navigation.
