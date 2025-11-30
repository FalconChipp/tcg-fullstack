// backend/src/services/inkthreadables.js
// -----------------------------------------------------------------------------
// Inkthreadables / POD integration hook.
// -----------------------------------------------------------------------------
// Direction: OUTBOUND (we call Inkthreadables)
//
// This version is wired to Inkthreadable's *real* API:
//
//   POST https://www.inkthreadable.co.uk/api/orders.php?AppId=...&Signature=...
//
// Auth:
//   - AppId      -> from your Inkthreadable "API Settings" page
//   - Secret Key -> from the same page
//   - Signature  -> SHA1( requestBody + SecretKey )
//
// Env (suggested):
//   INKTHREADABLES_DRY_RUN        (default "1" -> no API calls, just logging)
//   INKTHREADABLES_APP_ID         (AppId from Inkthreadables)
//   INKTHREADABLES_SECRET_KEY     (Secret Key from Inkthreadables)
//   INKTHREADABLES_BRAND_NAME     (optional, defaults to "SixByFive TCG")
//
// Backwards-compat note:
//   - If you already set INKTHREADABLES_API_KEY / INKTHREADABLES_API_SECRET,
//     we will fall back to them as AppId / SecretKey to avoid surprises.
//
// This service is called from podFulfilmentService.createPodOrder.
// -----------------------------------------------------------------------------


import axios from "axios";
import crypto from "crypto";

const DRY_RUN = process.env.INKTHREADABLES_DRY_RUN !== "0";

/**
 * Helper: safely parse shipping address JSON from the order and map to
 * Inkthreadables' `shipping_address` structure.
 */
function mapShippingAddress(order, log) {
  const rawAddress = order?.shippingAddressJson;
  if (!rawAddress) {
    log?.warn?.(
      "[Inkthreadables] Order has no shippingAddressJson; shipping_address will be null"
    );
    return null;
  }

  let addr = null;

  if (typeof rawAddress === "string") {
    try {
      addr = JSON.parse(rawAddress);
    } catch (e) {
      log?.error?.(
        "[Inkthreadables] Failed to parse shippingAddressJson string",
        e?.message || e
      );
      return null;
    }
  } else if (typeof rawAddress === "object") {
    addr = rawAddress;
  }

  if (!addr) return null;

  // Try to split a "name" field into first / last; fall back gracefully.
  const nameSource = addr.name || order.buyerName || "";
  let firstName = addr.firstName || "";
  let lastName = addr.lastName || "";

  if (!firstName && !lastName && nameSource) {
    const parts = String(nameSource).trim().split(/\s+/);
    if (parts.length === 1) {
      firstName = parts[0];
      lastName = "";
    } else {
      firstName = parts.slice(0, -1).join(" ");
      lastName = parts.slice(-1).join(" ");
    }
  }

  return {
    firstName,
    lastName,
    company: addr.company || "",
    address1: addr.address1 || addr.line1 || "",
    address2: addr.address2 || addr.line2 || "",
    city: addr.city || "",
    county: addr.county || addr.region || "",
    postcode: addr.postcode || addr.postalCode || "",
    country: addr.country || "",
    phone1: addr.phone1 || addr.phone || "",
    phone2: addr.phone2 || "",
    phone3: addr.phone3 || "",
    vatNumber: addr.vatNumber || "",
  };
}

/**
 * Helper: map our internal POD items to Inkthreadables `items` structure.
 *
 * EXPECTED INPUT (from podFulfilmentService):
 *   podItems[] = {
 *     listingId,
 *     qty,
 *     title,
 *     colourName,
 *     sizeLabel,
 *     productType,
 *     // NEW / IMPORTANT for Inkthreadables:
 *     pn,               // e.g. "STSU168-BLK-M"
 *     retailPrice,      // optional, decimal
 *     description,      // optional
 *     brandName,        // optional
 *     designs,          // { front: "https://...", back: "https://..." }
 *     mockups           // { front: "https://...", back: "https://..." }
 *   }
 */
function mapItemsForInkthreadables(podItems, log) {
  const mapped = [];

  for (const it of podItems) {
    if (!it.pn) {
      log?.error?.(
        "[Inkthreadables] POD item missing `pn` – skipping",
        JSON.stringify({
          listingId: it.listingId,
          title: it.title,
          colourName: it.colourName,
          sizeLabel: it.sizeLabel,
        })
      );
      continue;
    }

    const quantity = Number.isFinite(it.qty) ? it.qty : 1;

    // Flatten designs & mockups into the object shape shown in docs.
    const designs = it.designs && typeof it.designs === "object"
      ? it.designs
      : {};
    const mockups = it.mockups && typeof it.mockups === "object"
      ? it.mockups
      : {};

    mapped.push({
      pn: it.pn,
      title: it.title || "POD Product",
      // Inkthreadables docs show numeric fields as strings, so we stringify.
      retailPrice:
        it.retailPrice != null ? String(it.retailPrice) : undefined,
      quantity: String(quantity),
      description: it.description || "",
      brandName: it.brandName || undefined,
      // OPTIONAL: pass through colour/size info as part of description
      // if you want; not required by Inkthreadables schema.
      designs,
      mockups,
    });
  }

  return mapped;
}

/**
 * Submit an order to Inkthreadables **if** it has POD line items.
 *
 * @param {Object} order  Sequelize Order instance (or POJO with the same fields)
 * @param {Array}  items  Normalised cart line items (from metadata/cart)
 * @param {Object} ctx    Optional context: { logger?, models? }
 */
export async function submitInkthreadablesOrderIfNeeded(
  order,
  items,
  ctx = {}
) {
  const log = ctx.logger || console;
  const models = ctx.models || null;
  const cartItems = Array.isArray(items) ? items : [];

  // Only process items that are explicitly POD
  const podItems = cartItems.filter(
    (it) => String(it.fulfilmentType || "").toUpperCase() === "POD"
  );

  if (!podItems.length) {
    // No POD items → nothing to send
    return;
  }

  const summary = podItems.map((it) => ({
    listingId: it.listingId,
    qty: it.qty,
    title: it.title,
    colourName: it.colourName,
    sizeLabel: it.sizeLabel,
    productType: it.productType || "CLOTHING",
    pn: it.pn || null,
  }));

  log.info?.(
    `[Inkthreadables] Order ${order.id} has ${podItems.length} POD line item(s)`
  );

  if (DRY_RUN) {
    // Safe default while wiring everything up
    log.info?.(
      `[Inkthreadables] DRY-RUN mode: no API call performed. Summary: ${JSON.stringify(
        summary
      )}`
    );
    return;
  }

  // --- Real API call path (when INKTHREADABLES_DRY_RUN = "0") ----------------

  const baseUrl =
    process.env.INKTHREADABLES_API_URL ||
    "https://www.inkthreadable.co.uk/api/orders.php";

  // Prefer the new env names; fall back to legacy ones if present.
  const appId =
    process.env.INKTHREADABLES_APP_ID ||
    process.env.INKTHREADABLES_API_KEY ||
    "";
  const secretKey =
    process.env.INKTHREADABLES_SECRET_KEY ||
    process.env.INKTHREADABLES_API_SECRET ||
    "";

  if (!appId || !secretKey) {
    log.error?.(
      "[Inkthreadables] Missing INKTHREADABLES_APP_ID / INKTHREADABLES_SECRET_KEY (or legacy API_KEY/SECRET) – cannot submit POD order"
    );
    return;
  }

  const brandName =
    process.env.INKTHREADABLES_BRAND_NAME || "SixByFive TCG";

  const shipping_address = mapShippingAddress(order, log);
  const itemsPayload = mapItemsForInkthreadables(podItems, log);

  if (!itemsPayload.length) {
    log.error?.(
      "[Inkthreadables] No POD items with valid `pn` after mapping – aborting submit"
    );
    return;
  }

  // Build the request payload using Inkthreadable's fields.
  const payload = {
    external_id: order.orderNumber || order.id,
    brand: brandName,
    shipping_address, // may be null, but ideally populated
    items: itemsPayload,
  };

  // Prepare body JSON and Signature.
  const bodyJson = JSON.stringify(payload);

  const signature = crypto
    .createHash("sha1")
    .update(bodyJson + secretKey)
    .digest("hex");

  // Append AppId & Signature as query params, as per docs.
  const url = `${baseUrl}${
    baseUrl.includes("?") ? "&" : "?"
  }AppId=${encodeURIComponent(appId)}&Signature=${encodeURIComponent(
    signature
  )}`;

  try {
    log.info?.(
      `[Inkthreadables] Sending order ${order.id} to Inkthreadables API`
    );

    const res = await axios.post(url, bodyJson, {
      // We pass a pre-stringified JSON body, so prevent Axios from
      // re-stringifying it.
      transformRequest: [(data) => data],
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15_000,
    });

    const json = res?.data ?? null;

    log.info?.(
      `[Inkthreadables] Response for order ${order.id}: ${JSON.stringify(
        json
      )}`
    );

    // If we have access to models, persist POD metadata on the Order.
    if (models?.Order) {
      try {
        const OrderModel = models.Order;
        const freshOrder = await OrderModel.findByPk(order.id);

        if (freshOrder) {
          const existingMeta = freshOrder.metadataJson || {};
          const prevPod = existingMeta.pod || {};

          freshOrder.metadataJson = {
            ...existingMeta,
            pod: {
              ...prevPod,
              provider: "INKTHREADABLES",
              // Their response example uses "id" + "status"
              inkOrderId: json?.id ?? prevPod.inkOrderId ?? null,
              inkStatus: json?.status ?? prevPod.inkStatus ?? "submitted",
              lastResponse: json ?? prevPod.lastResponse ?? null,
              lastSyncedAt: new Date().toISOString(),
              lastError: null,
              lastErrorAt: null,
            },
          };

          await freshOrder.save();
        }
      } catch (metaErr) {
        log.error?.(
          "[Inkthreadables] Failed to persist POD metadata on order",
          metaErr?.message || metaErr
        );
      }
    }
  } catch (err) {
    log.error?.(
      `[Inkthreadables] Error while submitting order ${order.id}: ${
        err.stack || err.message || String(err)
      }`
    );

    // Do not throw – but if we can, record the error into order.metadataJson.pod
    if (models?.Order) {
      try {
        const OrderModel = models.Order;
        const freshOrder = await OrderModel.findByPk(order.id);

        if (freshOrder) {
          const existingMeta = freshOrder.metadataJson || {};
          const prevPod = existingMeta.pod || {};

          freshOrder.metadataJson = {
            ...existingMeta,
            pod: {
              ...prevPod,
              provider: "INKTHREADABLES",
              inkOrderId: prevPod.inkOrderId ?? null,
              inkStatus: prevPod.inkStatus ?? "error",
              lastResponse: prevPod.lastResponse ?? null,
              lastSyncedAt: prevPod.lastSyncedAt ?? null,
              lastError: err?.message || String(err),
              lastErrorAt: new Date().toISOString(),
            },
          };

          await freshOrder.save();
        }
      } catch (metaErr) {
        log.error?.(
          "[Inkthreadables] Failed to persist POD error metadata on order",
          metaErr?.message || metaErr
        );
      }
    }
  }
}
