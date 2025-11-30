// backend/src/modules/marketplace/services/podFulfilmentService.js
// -----------------------------------------------------------------------------
// podFulfilmentService
// -----------------------------------------------------------------------------
// Single place that knows how to trigger POD fulfilment for a paid order.
// In this project, POD is handled by Inkthreadables via the
// `submitInkthreadablesOrderIfNeeded` service.
//
// IMPORTANT:
//  - Called only AFTER payment is confirmed in ordersService.markOrderPaid.
//  - MUST NOT throw, otherwise the Stripe webhook can fail.
//  - Safe to call for non-POD listings; it will simply log + no-op.
// -----------------------------------------------------------------------------
//
// CHANGES IN THIS VERSION:
//  - Normalises and parses listing.fulfilmentMetaJson safely.
//  - Adds Inkthreadables-specific fields to the POD line item:
//      * productCode      (e.g. "STSU168")
//      * colourCode       (e.g. "BLK")
//      * colourName       (human label, e.g. "Black")
//      * sizeLabel        (e.g. "M")
//      * unitPrice        (listing.price)
//      * designFrontUrl   (print file for front / left chest)
//      * designBackUrl    (print file for back)
//      * mockupFrontUrl   (optional mockup image URL)
//      * mockupBackUrl    (optional mockup image URL)
//      * brandName        (optional Inkthreadables brand name)
//  - These extra fields are consumed by services/inkthreadables.js to
//    build a valid Inkthreadables order payload.
// -----------------------------------------------------------------------------

import { submitInkthreadablesOrderIfNeeded } from "../../../services/inkthreadables.js";

const podFulfilmentService = {
  /**
   * Trigger POD fulfilment for a given order/listing pair.
   *
   * @param {Object} input
   *   - order   Sequelize Order instance (or POJO with id, quantity, etc.)
   *   - listing Sequelize Listing instance (or POJO with fulfilment fields)
   * @param {Object} ctx
   *   - logger?  (winston-style logger; falls back to console)
   *   - config?  (optional extra config)
   *   - models?  (Sequelize models, for metadata persistence inside POD layer)
   * @param {Object} txn
   *   - Optional Sequelize transaction (kept for signature compatibility;
   *     not currently used inside this service).
   */
  async createPodOrder(input, ctx = {}, txn) {
    const logger = ctx.logger || console;
    const { order, listing } = input || {};

    if (!order || !listing) {
      logger.error?.("[podFulfilment] Missing order/listing for POD fulfilment", {
        hasOrder: !!order,
        hasListing: !!listing,
      });
      return null;
    }

    const fulfilmentType = String(listing.fulfilmentType || "").toUpperCase();

    // Only handle POD listings; anything else is a no-op.
    if (fulfilmentType !== "POD") {
      logger.info?.("[podFulfilment] Listing is not POD; skipping", {
        orderId: order.id,
        listingId: listing.id,
        fulfilmentType: listing.fulfilmentType,
      });
      return null;
    }

    // -------------------------------------------------------------------------
    // Normalise + parse fulfilmentMetaJson
    // -------------------------------------------------------------------------
    let meta = listing.fulfilmentMetaJson || {};

    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch (err) {
        logger.error?.(
          "[podFulfilment] Failed to parse listing.fulfilmentMetaJson",
          {
            listingId: listing.id,
            error: err?.message || String(err),
          }
        );
        meta = {};
      }
    }

    // Some helpers to normalise meta fields / aliases coming from UI or seeding.
    const colourName =
      meta.colourName ||
      meta.colour ||
      meta.colour_label ||
      meta.colourLabel ||
      null;

    const colourCode =
      meta.colourCode ||
      meta.colour_code ||
      meta.inkColourCode ||
      null;

    const sizeLabel =
      meta.sizeLabel ||
      meta.size ||
      meta.size_code ||
      meta.inkSize ||
      null;

    const productCode =
      meta.productCode || meta.inkProductCode || meta.ink_productCode || null;

    const brandName = meta.brandName || meta.brand_name || null;

    // Design / mockup URLs (can be absolute or relative; the Inkthreadables
    // service will NOT rewrite them, so best to make them absolute URLs if
    // Inkthreadables needs to fetch them directly).
    const designFrontUrl =
      meta.designFrontUrl ||
      meta.design_front_url ||
      meta.frontDesignUrl ||
      null;

    const designBackUrl =
      meta.designBackUrl ||
      meta.design_back_url ||
      meta.backDesignUrl ||
      null;

    const mockupFrontUrl =
      meta.mockupFrontUrl ||
      meta.mockup_front_url ||
      meta.frontMockupUrl ||
      null;

    const mockupBackUrl =
      meta.mockupBackUrl ||
      meta.mockup_back_url ||
      meta.backMockupUrl ||
      null;

    const description =
      meta.description ||
      meta.specialInstructions ||
      meta.notes ||
      null;

    const unitPrice =
      typeof listing.price === "number"
        ? listing.price
        : Number(listing.price) || null;

    // -------------------------------------------------------------------------
    // Build a single "cart item" that matches the shape expected by
    // backend/src/services/inkthreadables.js.
    // -------------------------------------------------------------------------
    const podItem = {
      listingId: listing.id,
      qty: Number(order.quantity) || 1,
      title: listing.title || meta.title || "POD Product",
      // Generic POD info
      productType: meta.productType || "CLOTHING",
      fulfilmentType: "POD",

      // Inkthreadables-specific fields
      productCode,    // e.g. "STSU168"
      colourCode,     // e.g. "BLK"
      colourName,     // e.g. "Black"
      sizeLabel,      // e.g. "M"
      unitPrice,      // listing price per unit
      description,    // optional line-item notes
      brandName,      // optional brand override

      // Print file URLs
      designFrontUrl, // e.g. left chest embroidery PNG
      designBackUrl,  // e.g. back DTF print PNG

      // Optional mockup URLs (not required by Inkthreadables)
      mockupFrontUrl,
      mockupBackUrl,
    };

    const items = [podItem];

    try {
      logger.info?.("[podFulfilment] Submitting POD order via Inkthreadables", {
        orderId: order.id,
        listingId: listing.id,
        qty: podItem.qty,
        productCode: podItem.productCode,
        colourCode: podItem.colourCode,
        sizeLabel: podItem.sizeLabel,
      });

      // NOTE: we pass ctx through so the Inkthreadables service
      // can persist metadata into Order.metadataJson.pod.
      await submitInkthreadablesOrderIfNeeded(order, items, ctx);

      // We don't expect a return value for now; if you later want to store
      // Inkthreadables order IDs here, you can make the helper return data.
      return null;
    } catch (err) {
      // Hard safety net: even if something unexpected happens inside the
      // Inkthreadables integration, do NOT break Stripe webhooks.
      logger.error?.("[podFulfilment] Unexpected error during POD submission", {
        orderId: order.id,
        listingId: listing.id,
        error: err?.message || String(err),
      });
      return null;
    }
  },
};

export default podFulfilmentService;
