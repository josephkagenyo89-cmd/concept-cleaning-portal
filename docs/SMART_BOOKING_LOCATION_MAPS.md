# Smart Booking service location

Status: Google Maps integration paused. The booking flow currently uses a plain service-address field.

## Customer experience

- Customers enter the service address as text.
- Prompt customers to include the estate, building, road or a nearby landmark.
- Customers can provide further access details in the existing notes field on the service-detail request form.
- Booking and quotation requests do not require a GPS pin, browser location permission, Google Places search or map interaction.

## ERP experience

- Guest Requests displays the submitted address and customer notes.
- Booking Details displays the saved booking address and contact details.
- No Google Maps navigation link or embedded map is provided while this feature is paused.

## Data and compatibility

- No database schema, RPC, Supabase data or production configuration was changed for this pause.
- Existing location values containing the legacy `[CCS_GPS:latitude,longitude]` suffix remain readable; the admin display helper strips that suffix without opening a map.
- The service-location helper is retained for legacy data compatibility and possible future reactivation. It is not imported by the active booking UI.
- The guest request endpoint continues to accept a normal address in its existing text location field.

## Google Maps configuration

No Google Maps API key or Map ID is required by the current booking flow. Do not add `VITE_GOOGLE_MAPS_API_KEY` or `VITE_GOOGLE_MAPS_MAP_ID` for this paused implementation.

## Future reactivation

If map-based location selection is approved later, reintroduce it as a separately tested change. Before doing so, confirm the desired provider, data-storage approach and service-area handling. Do not add database columns or migrations without separate approval.
