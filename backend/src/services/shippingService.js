// backend/src/services/shippingService.js
// -----------------------------------------------------------------------------
// Shipping service (MVP)
//
// - Computes a single shipping line for a cart.
// - UK-only, flat rate per fulfilment type.
// - Mixed cart -> highest applicable rate.
// - CARD items are always sent using a TRACKED method.
// -----------------------------------------------------------------------------

import {
  SHIPPING_ZONES,
  SHIPPING_RATES_BY_FULFILMENT,
  DEFAULT_ZONE_CODE,
  DEFAULT_METHOD_KEY,
} from "../config/shippingConfig.js";

/**
 * Infer shipping zone from address.
 * For now: if country looks like UK -> "UK", else default "UK".
 */
export function inferZoneFromAddress(address) {
  if (!address) return DEFAULT_ZONE_CODE;
  const raw = String(address.country || "").toLowerCase();

  if (
    raw.includes("united kingdom") ||
    raw === "uk" ||
    raw === "gb" ||
    raw === "gbp" ||
    raw === "great britain"
  ) {
    return "UK";
  }

  // Later: add EU/US/etc.
  return DEFAULT_ZONE_CODE;
}

/**
 * Normalise the "customer" object from the checkout payload
 * into the shape we store on the order as shippingAddressJson.
 */
export function normaliseShippingAddress(customer) {
  if (!customer) return null;

  return {
    name: customer.name || "",
    email: customer.email || "",
    address1: customer.address1 || "",
    address2: customer.address2 || "",
    city: customer.city || "",
    postcode: customer.postcode || "",
    country: customer.country || "United Kingdom",
    notes: customer.notes || "",
  };
}

/**
 * Compute shipping for a cart.
 *
 * @param {Array} cartItems - items from metadataJson.cartItems (or request body)
 * @param {Object} customer - checkout.customer object (with address)
 *
 * Returns:
 *   {
 *     zoneCode,
 *     methodCode,
 *     methodLabel,
 *     cost,
 *     tracked,            // <-- true if the chosen method is tracked
 *     requiresTracking,   // <-- true if any CARD is present in cart
 *     address
 *   }
 */
export function estimateShipping(cartItems, customer) {
  const items = Array.isArray(cartItems) ? cartItems : [];
  const address = normaliseShippingAddress(customer);
  const zoneCode = inferZoneFromAddress(address);
  const zone = SHIPPING_ZONES[zoneCode] || SHIPPING_ZONES[DEFAULT_ZONE_CODE];

  const zoneMethods = zone.methods || {};
  const defaultMethod =
    zoneMethods[DEFAULT_METHOD_KEY] ||
    Object.values(zoneMethods)[0] || {
      code: `${zoneCode}_${DEFAULT_METHOD_KEY}`,
      label: "Standard shipping",
      baseRate: 3.5,
      tracked: false,
    };

  // Collect fulfilment types + track if any card is present
  const fulfilments = new Set();
  let hasCard = false;

  for (const item of items) {
    const ftRaw = item.fulfilmentType || item.fulfilment_type || item.productType;
    if (!ftRaw) continue;
    const ft = String(ftRaw).toUpperCase();
    fulfilments.add(ft);
    if (ft === "CARD") hasCard = true;
  }

  // Decide method & rate.
  // Strategy:
  //   - For each fulfilment type, look up SHIPPING_RATES_BY_FULFILMENT[ft].
  //   - Keep the *highest* rate as the cart shipping cost.
  //   - If any CARD present, we force a TRACKED method.
  let chosenCost = defaultMethod.baseRate;
  let chosenTracked = defaultMethod.tracked || false;
  let chosenMethodKey = DEFAULT_METHOD_KEY;

  if (fulfilments.size > 0) {
    let maxCost = 0;
    let maxTracked = false;
    let maxMethodKey = DEFAULT_METHOD_KEY;

    for (const ft of fulfilments) {
      const cfg = SHIPPING_RATES_BY_FULFILMENT[ft];
      if (!cfg) continue;

      const cost = typeof cfg.cost === "number" ? cfg.cost : defaultMethod.baseRate;
      const tracked = !!cfg.tracked;
      const methodKey = cfg.methodKey || DEFAULT_METHOD_KEY;

      // Priority: higher cost wins. If same cost, tracked wins.
      if (cost > maxCost || (cost === maxCost && tracked && !maxTracked)) {
        maxCost = cost;
        maxTracked = tracked;
        maxMethodKey = methodKey;
      }
    }

    if (maxCost > 0) {
      chosenCost = maxCost;
      chosenTracked = maxTracked;
      chosenMethodKey = maxMethodKey;
    }
  }

  // If there is any CARD in the cart, force tracked regardless
  if (hasCard) {
    chosenTracked = true;
    // Try to switch to the zone's TRACKED method if available
    if (zoneMethods.TRACKED) {
      chosenMethodKey = "TRACKED";
      chosenCost = zoneMethods.TRACKED.baseRate;
    }
  }

  const method = zoneMethods[chosenMethodKey] || defaultMethod;

  return {
    zoneCode,
    methodCode: method.code,
    methodLabel: method.label,
    cost: chosenCost,
    tracked: chosenTracked,
    requiresTracking: hasCard,
    address,
  };
}
