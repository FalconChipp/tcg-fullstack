// backend/src/config/shippingConfig.js
// -----------------------------------------------------------------------------
// Central place for shipping rules / constants (MVP).
// -----------------------------------------------------------------------------
//
// Current assumptions:
//  - UK-only
//  - Flat rate per fulfilment type
//  - Mixed cart -> highest applicable rate
//  - CARD must always be sent TRACKED
// -----------------------------------------------------------------------------

// Zones (only UK for now)
export const SHIPPING_ZONES = {
  UK: {
    code: "UK",
    label: "United Kingdom",
    methods: {
      STANDARD: {
        code: "UK_STANDARD",
        label: "UK standard shipping",
        baseRate: 3.5,
        tracked: false,
      },
      TRACKED: {
        code: "UK_TRACKED",
        label: "UK tracked shipping",
        baseRate: 4.5,
        tracked: true,
      },
    },
  },
};

// Flat-rate overrides by fulfilment type.
// Each entry can specify:
//   - cost: number
//   - tracked: boolean
//   - methodKey: "STANDARD" | "TRACKED" | etc within the zone
//
// IMPORTANT: CARD is forced to tracked.
export const SHIPPING_RATES_BY_FULFILMENT = {
  CARD: {
    cost: 3.0,
    tracked: true,
    methodKey: "TRACKED", // use the zone's TRACKED method
  },
  "3D_PRINT": {
    cost: 2.49,
    tracked: false,
    methodKey: "STANDARD",
  },
  CLOTHING: {
    cost: 3.5,
    tracked: false,
    methodKey: "STANDARD",
  },
};

// Defaults
export const DEFAULT_ZONE_CODE = "UK";
export const DEFAULT_METHOD_KEY = "STANDARD"; // key inside zone.methods
