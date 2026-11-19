import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const addons = read('supabase/migrations/20261118100417_smart_booking_selectable_priced_addons.sql');
const requestPricing = read('supabase/migrations/20261119190000_complete_booking_engine_package_pricing.sql');
const guestBridge = read('supabase/migrations/20261119220000_guest_smart_booking_bridge.sql');
const config = read('supabase/config.toml');
const edge = read('supabase/functions/submit-guest-service-request/index.ts');

assert.match(guestBridge, /IF substring\(v_extra FROM 7\) !~\* '\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$' THEN/);
assert.match(guestBridge, /v_addon_offer_updated_at IS DISTINCT FROM/);
assert.match(guestBridge, /Rejected or closed guest requests cannot become ERP bookings/);
assert.match(guestBridge, /p_channel IS NULL OR p_channel NOT IN/);
assert.match(guestBridge, /SET search_path = ''/);
assert.doesNotMatch(guestBridge, /IF substring\(v_extra FROM 7\)[^\n]*\n\s+ELSE/);

assert.match(addons, /public\.assert_booking_engine_item_measurements/);
assert.match(addons, /public\.assert_guest_booking_engine_answers\(/);
assert.match(addons, /public\.is_staff\(auth\.uid\(\)\)/);
assert.match(addons, /package_service\.value->>'service_id' = addon_service\.value->>'service_id'/);
assert.match(addons, /previous_service\.value->>'service_id' = current_service\.value->>'service_id'/);
assert.match(addons, /CASE WHEN v_addon->>'price_mode' = 'fixed' THEN v_amount ELSE v_discount_amount END/);
assert.match(addons, /One or more selected add-ons have not been priced/);
assert.match(addons, /offer_updated_at/);

assert.match(requestPricing, /v_result := public\.calculate_booking_engine_item_price\(v_item\.id\)/);
assert.match(requestPricing, /'selected_addons', v_selected_addons/);
assert.doesNotMatch(requestPricing, /IF COALESCE\(v_offer_snapshot->>'offer_type',''\)='package'/);
assert.match(requestPricing, /v_request\.customer_user_id IS NOT NULL/);
assert.match(config, /\[functions\.submit-guest-service-request\]\s+verify_jwt = false/);
assert.match(edge, /headers\.delete\('Authorization'\)/);
assert.match(edge, /const hasGuidedDetails = rawDetails !== undefined && rawDetails !== null/);
assert.match(edge, /\{ legacy_request: true \}/);
assert.match(edge, /const submissionKey = suppliedSubmissionKey \|\| null/);
assert.match(guestBridge, /standard guest form and has no guided Smart Booking snapshot/);

console.log('Smart Booking SQL contract checks passed.');
