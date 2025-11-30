// backend/src/webhooks/inkthreadables.js
// -----------------------------------------------------------------------------
// Inkthreadables Webhook Handler
// -----------------------------------------------------------------------------
// Direction: INBOUND (Inkthreadables calls us)
//
// Purpose:
//   - Receive status updates from Inkthreadables for POD orders.
//   - Find the matching Order using the "reference" (orderNumber).
//   - Update Order.metadataJson.pod with:
//       * inkOrderId
//       * inkStatus
//       * trackingNumber / trackingUrl (if provided)
//       * lastWebhookPayload
//       * lastSyncedAt
//       * lastError / lastErrorAt (cleared on success)
//   - Map Inkthreadables status -> internal fulfilment pipeline.
//
// IMPORTANT BEHAVIOUR:
//   - ALWAYS return 200 to Inkthreadables (even if we can't find the order).
//   - NEVER throw out of the handler (log and move on).
//   - Models are obtained from req.app.locals.models (no direct import).
// -----------------------------------------------------------------------------

/**
 * Try to extract a human-readable string from an error.
 */
function errToString(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  return String(err);
}

/**
 * Map Inkthreadables status -> our internal fulfilment pipeline.
 *
 * pending/queued      -> processing
 * in_production/...   -> in_printing
 * shipped/dispatch    -> shipped
 * delivered/completed -> completed
 * cancelled           -> cancelled
 */
function mapInkStatusToFulfilment(statusRaw) {
  if (!statusRaw) return null;
  const status = String(statusRaw).toLowerCase();

  if (["pending", "queued"].includes(status)) return "processing";
  if (["in_production", "printing", "in_printing"].includes(status))
    return "in_printing";
  if (["shipped", "dispatch", "despatched"].includes(status)) return "shipped";
  if (["delivered", "completed"].includes(status)) return "completed";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";

  // Unknown / unhandled status – we still store it in pod.inkStatus
  return null;
}

/**
 * Safely parse whatever Inkthreadables sends to something we can use.
 *
 * Expected common shapes (you'll tweak this once you have their spec):
 *
 *  {
 *    "event": "order.status_updated",
 *    "data": {
 *      "reference": "SBF-20251125-000123",
 *      "id": 123456,
 *      "status": "in_production",
 *      "tracking_number": "XYZ123",
 *      "tracking_url": "https://..."
 *    }
 *  }
 */
function extractWebhookData(body) {
  const root = body || {};
  const data = root.data || root;

  const eventType = root.event || root.type || null;

  const reference =
    data.reference ||
    root.reference ||
    data.order_reference ||
    data.orderRef ||
    null;

  const inkOrderId =
    data.id || data.order_id || root.inkOrderId || root.order_id || null;

  const status = data.status || root.status || null;

  const trackingNumber =
    data.tracking_number || data.trackingNumber || null;

  const trackingUrl = data.tracking_url || data.trackingUrl || null;

  return {
    eventType,
    reference,
    inkOrderId,
    status,
    trackingNumber,
    trackingUrl,
    raw: body,
  };
}

/**
 * Main Express handler for Inkthreadables webhooks.
 *
 * Mount with something like:
 *   import inkthreadablesWebhook from "./src/webhooks/inkthreadables.js";
 *   app.post(
 *     "/webhooks/inkthreadables",
 *     express.json({ type: "application/json" }),
 *     inkthreadablesWebhook
 *   );
 */
export default async function inkthreadablesWebhook(req, res) {
  const logger = req.app?.locals?.logger || console;

  try {
    const payload = req.body || {};
    const {
      eventType,
      reference,
      inkOrderId,
      status,
      trackingNumber,
      trackingUrl,
      raw,
    } = extractWebhookData(payload);

    logger.info?.("[InkthreadablesWebhook] Incoming webhook", {
      eventType,
      reference,
      inkOrderId,
      status,
      trackingNumber,
      trackingUrl,
    });

    if (!reference) {
      logger.warn?.(
        "[InkthreadablesWebhook] Missing reference in payload – cannot map to order"
      );
      // Always 200 so Inkthreadables doesn't retry indefinitely.
      return res
        .status(200)
        .json({ received: true, ignored: "missing_reference" });
    }

    // Get models from app locals instead of importing models directly
    const models = req.app?.locals?.models;

    if (!models?.Order) {
      logger.error?.(
        "[InkthreadablesWebhook] models.Order not available – check models wiring in index.js"
      );
      return res
        .status(200)
        .json({ received: true, ignored: "order_model_unavailable" });
    }

    const { Order } = models;

    // First try matching by orderNumber (this is what we send as "reference")
    let order = await Order.findOne({
      where: { orderNumber: reference },
    });

    // Fallback: treat reference as an Order primary key (UUID) if needed
    if (!order) {
      order = await Order.findByPk(reference).catch(() => null);
    }

    if (!order) {
      logger.warn?.(
        "[InkthreadablesWebhook] Order not found for reference",
        { reference }
      );
      return res
        .status(200)
        .json({ received: true, ignored: "order_not_found" });
    }

    // ---------------- Update metadataJson.pod -----------------------

    const existingMeta = order.metadataJson || {};
    const prevPod = existingMeta.pod || {};

    // Store the raw payload for debugging.
    const lastWebhookPayload = raw;
    const nowIso = new Date().toISOString();

    order.metadataJson = {
      ...existingMeta,
      pod: {
        ...prevPod,
        provider: "INKTHREADABLES",
        inkOrderId: inkOrderId ?? prevPod.inkOrderId ?? null,
        inkStatus: status || prevPod.inkStatus || null,
        trackingNumber: trackingNumber ?? prevPod.trackingNumber ?? null,
        trackingUrl: trackingUrl ?? prevPod.trackingUrl ?? null,
        lastResponse: prevPod.lastResponse ?? null,
        lastWebhookPayload,
        lastSyncedAt: nowIso,
        lastError: null,
        lastErrorAt: null,
      },
    };

    // ---------------- Update fulfilment pipeline --------------------

    const mappedStatus = mapInkStatusToFulfilment(status);

    if (mappedStatus) {
      // Your Order model now has fulfilmentStatus, so this will persist.
      order.fulfilmentStatus = mappedStatus;
    }

    await order.save();

    logger.info?.("[InkthreadablesWebhook] Order updated from webhook", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      inkOrderId,
      inkStatus: status,
    });

    return res.status(200).json({ received: true });
  } catch (err) {
    const msg = errToString(err);
    console.error("[InkthreadablesWebhook] Unexpected error:", msg);

    // Critical: still return 200 so Inkthreadables doesn't spam retries.
    return res.status(200).json({ received: true, error: msg });
  }
}
