/**
 * BOOKING AGENT CONFIGURATION & CONSTANTS
 */

export const SERVICE_FAMILIES = {
  UPHOLSTERY: {
    name: "upholstery",
    displayName: "Upholstery Cleaning",
    aliases: ["sofa", "couch", "furniture", "mattress"],
  },
  CARPET: {
    name: "carpet",
    displayName: "Carpet Cleaning",
    aliases: ["carpet", "rug", "flooring", "floor"],
  },
  PEST_CONTROL: {
    name: "pest_control",
    displayName: "Pest Control",
    aliases: ["pest", "fumigation", "cockroach", "termite", "bedbug"],
  },
  CAR_INTERIOR: {
    name: "car_interior",
    displayName: "Car Interior Cleaning",
    aliases: ["car", "vehicle", "interior", "detailing"],
  },
  POST_CONSTRUCTION: {
    name: "post_construction",
    displayName: "Post-Construction Cleaning",
    aliases: ["construction", "post", "renovation", "after-build"],
  },
} as const;

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.75,
  MEDIUM: 0.6,
  LOW: 0.5,
  AUTO_FLAG_THRESHOLD: 0.6,
} as const;

export const PHOTO_CATEGORIES = {
  OVERALL_AREA: "overall_area",
  PROBLEM_AREA: "problem_area",
  STAIN: "stain",
  DAMAGE: "damage",
  PEST_EVIDENCE: "pest_evidence",
  MEASUREMENT: "measurement",
  OTHER: "other",
} as const;

export const FLAG_REASONS = {
  UNMATCHED_SERVICE: "unmatched_service",
  QUOTATION_REQUIRED: "quotation_required",
  AMBIGUOUS_MATCH: "ambiguous_match",
  REQUIRES_ASSESSMENT: "requires_assessment",
  HIGH_VALUE_BOOKING: "high_value_booking",
  URGENT_REQUEST: "urgent_request",
} as const;

export const FLAG_PRIORITIES = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const PHOTO_CONFIG = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILES_PER_REQUEST: 20,
  ALLOWED_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
  ],
  BUCKET_NAME: "booking-engine-photos",
} as const;

export const PRICING_CONFIG = {
  CURRENCY: "KES",
  DECIMAL_PLACES: 2,
  HIGH_VALUE_THRESHOLD: 10000,
} as const;

export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

export function isHighValueBooking(totalPrice: number): boolean {
  return totalPrice > PRICING_CONFIG.HIGH_VALUE_THRESHOLD;
}
