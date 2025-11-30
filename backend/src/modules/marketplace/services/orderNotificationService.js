// backend/src/modules/marketplace/services/orderNotificationService.js
// -----------------------------------------------------------------------------
// Order Notification Service
//
// Handles:
//   - CARD listings:
//       * Email → buyer
//       * Email → seller
//       * App/site notifications → buyer & seller (stubbed)
//   - PRODUCT listings:
//       * Email → buyer
//       * App/site notifications → buyer (stubbed)
//       * Discord alert → store owner
//
// Uses:
//   - emailBase() → branded HTML template
//   - sendMail()
//   - sendOrderNotification()
//
// This version includes:
//   ✔ Multi-item email support, reading from metadataJson.cartItems/items
//   ✔ Branded HTML emails with full styling
//   ✔ Order number in Discord + emails
//   ✔ Case-insensitive listing types so PRODUCT / product both work
//   ✔ Safely parse metadataJson when it is stored as a JSON string
//   ✔ NEW: fulfilment status emails (in_printing + shipped)
// -----------------------------------------------------------------------------

import emailBase from '../../../emails/emailBase.js';
import { sendMail } from '../../../utils/email.js';
import { sendOrderNotification } from '../../../utils/discordWebhook.js';

/* -------------------------------------------------------------------------- */
/*  TEMP APP NOTIFICATIONS (Stub)                                             */
/* -------------------------------------------------------------------------- */

const appNotificationService = {
  async sendNotification({ userId, type, title, body, data }) {
    if (!userId) return;
    // eslint-disable-next-line no-console
    console.log('[APP NOTIFICATION][stub]', { userId, type, title, body, data });
  },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

async function loadOrderWithRelations(orderOrId, ctx) {
  const { models } = ctx;
  if (!models) throw new Error('orderNotificationService: ctx.models is required');

  const { Order, Listing, User } = models;

  const id =
    typeof orderOrId === 'string' || typeof orderOrId === 'number'
      ? orderOrId
      : orderOrId?.id;

  if (!id) throw new Error('orderNotificationService: invalid order identifier');

  const order = await Order.findByPk(id, {
    include: [
      { model: Listing, as: 'listing' },
      { model: User, as: 'buyer' },
      { model: User, as: 'seller' },
    ],
  });

  if (!order) throw new Error('Order not found for notifications');

  return order;
}

function getBuyerEmail(order) {
  return order.buyerEmail || order.buyer?.email || null;
}

function getBuyerName(order) {
  if (order.buyerName) return order.buyerName;
  if (order.buyer?.displayName) return order.buyer.displayName;
  if (order.buyer?.username) return order.buyer.username;
  if (order.buyerEmail) return order.buyerEmail;
  return 'Customer';
}

function getSellerEmail(order) {
  return order.seller?.email || null;
}

function getSellerName(order) {
  if (order.seller?.displayName) return order.seller.displayName;
  if (order.seller?.username) return order.seller.username;
  return 'Seller';
}

/**
 * Safely normalise metadataJson into a plain object, even if stored as a string.
 */
function safeGetMetadata(order) {
  let meta = order.metadataJson;

  if (!meta) return {};

  // If Sequelize column is JSONB you'll already get an object.
  // If it's TEXT, you'll get a JSON string here.
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[orderNotificationService] Failed to parse order.metadataJson as JSON:',
        err?.message || err
      );
      return {};
    }
  }

  if (meta && typeof meta === 'object') {
    return meta;
  }

  return {};
}

/**
 * Normalise line items for an order.
 *
 * Priority:
 *   1) order.metadataJson.cartItems  (current Stripe cart shape)
 *   2) order.metadataJson.items      (fallback if you ever stored it that way)
 *   3) Single listing + quantity on the order
 */
function getOrderLineItems(order) {
  const meta = safeGetMetadata(order);

  const sourceArray = Array.isArray(meta.cartItems)
    ? meta.cartItems
    : Array.isArray(meta.items)
    ? meta.items
    : null;

  if (sourceArray && sourceArray.length > 0) {
    return sourceArray.map((item) => {
      const qty = Number(item.qty ?? item.quantity) || 1;
      const price = Number(item.price ?? item.unitAmount) || 0;
      const currency = (item.currency || order.currency || 'GBP').toUpperCase();

      return {
        title: item.title || item.name || 'Item',
        qty,
        price,
        currency,
        fulfilmentType: item.fulfilmentType || null,
        productType: item.productType || null,
      };
    });
  }

  // 3) Legacy / single-listing orders
  const listingTitle = order.listing?.title || 'Listing';
  const qty = Number(order.quantity) || 1;
  const price = Number(order.total || order.subtotal) || 0;
  const currency = (order.currency || 'GBP').toUpperCase();

  return [
    {
      title: listingTitle,
      qty,
      price,
      currency,
      fulfilmentType: order.listing?.fulfilmentType || null,
      productType: order.listing?.type || null,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  EMAIL BUILDERS (Branded)                                                  */
/* -------------------------------------------------------------------------- */

function buildBuyerEmail(order) {
  const buyerName = getBuyerName(order);
  const lineItems = getOrderLineItems(order);
  const itemCount = lineItems.reduce((sum, it) => sum + (it.qty || 0), 0);
  const currency = order.currency || (lineItems[0] && lineItems[0].currency) || 'GBP';

  const itemsHtml = lineItems
    .map(
      (item) => `
      <li style="margin:6px 0; padding:8px 0; border-bottom:1px solid #e6e8ef;">
        <span style="font-weight:600;color:#232346;">${item.title}</span>
        <span style="color:#606480;"> &times; ${item.qty}</span>
        <span style="float:right;font-weight:700;color:#232346;">
          ${item.price.toFixed(2)} ${item.currency || currency}
        </span>
        <div style="clear:both;"></div>
      </li>`
    )
    .join('');

  const html = emailBase({
    title: 'Order Confirmation',
    heading: 'Your order has been received',
    content: `
      <p style="color:#44475a;font-size:14px;line-height:22px;">
        Hi <strong>${buyerName}</strong>,<br><br>
        Thank you for your order on <strong>SixByFive TCG</strong>!<br>
        Your order reference is
        <strong style="color:#2963FF;">${order.orderNumber}</strong>.
      </p>

      <h4 style="margin:26px 0 12px;font-size:16px;color:#232346;">Order Summary</h4>

      <ul style="padding:0;margin:0;list-style:none;">
        ${itemsHtml}
      </ul>

      <p style="margin-top:20px;font-size:14px;color:#232346;">
        <strong>Total items:</strong> ${itemCount}<br>
        <strong>Order total:</strong> ${order.total} ${currency}
      </p>
    `,
    outro: "You'll receive another update once your order has shipped.",
  });

  return {
    subject: `Your SixByFive TCG order ${order.orderNumber}`,
    text: '', // HTML is primary
    html,
  };
}

function buildSellerCardEmail(order) {
  const sellerName = getSellerName(order);
  const buyerName = getBuyerName(order);
  const lineItems = getOrderLineItems(order);
  const itemCount = lineItems.reduce((sum, it) => sum + (it.qty || 0), 0);
  const currency = order.currency || (lineItems[0] && lineItems[0].currency) || 'GBP';

  const itemsHtml = lineItems
    .map(
      (item) => `
      <li style="margin:6px 0; padding:8px 0; border-bottom:1px solid #e6e8ef;">
        <span style="font-weight:600;color:#232346;">${item.title}</span>
        <span style="color:#606480;"> &times; ${item.qty}</span>
        <span style="float:right;font-weight:700;color:#232346;">
          ${item.price.toFixed(2)} ${item.currency || currency}
        </span>
        <div style="clear:both;"></div>
      </li>`
    )
    .join('');

  const html = emailBase({
    title: 'New card order',
    heading: 'You’ve received a new card order',
    content: `
      <p style="color:#44475a;font-size:14px;line-height:22px;">
        Hi <strong>${sellerName}</strong>,<br><br>
        A new <strong>card order</strong> was placed on SixByFive TCG.<br>
        Order reference:
        <strong style="color:#2963FF;">${order.orderNumber}</strong>.
      </p>

      <h4 style="margin:26px 0 12px;font-size:16px;color:#232346;">Order Summary</h4>

      <ul style="padding:0;margin:0;list-style:none;">
        ${itemsHtml}
      </ul>

      <p style="margin-top:20px;font-size:14px;color:#232346;">
        <strong>Total items:</strong> ${itemCount}<br>
        <strong>Order total:</strong> ${order.total} ${currency}<br>
        <strong>Buyer:</strong> ${buyerName}
      </p>
    `,
    outro: 'Please pack the card carefully and mark the order as shipped.',
  });

  return {
    subject: `New card order ${order.orderNumber}`,
    text: '',
    html,
  };
}

/**
 * NEW: Build email for fulfilment status updates (buyer-facing).
 * Only used for in_printing + shipped.
 */
function buildFulfilmentStatusBuyerEmail(order, normalisedStatus) {
  const buyerName = getBuyerName(order);
  const lineItems = getOrderLineItems(order);
  const currency = order.currency || (lineItems[0] && lineItems[0].currency) || 'GBP';

  const itemsHtml = lineItems
    .map(
      (item) => `
      <li style="margin:4px 0; padding:6px 0; border-bottom:1px solid #e6e8ef;">
        <span style="font-weight:600;color:#232346;">${item.title}</span>
        <span style="color:#606480;"> &times; ${item.qty}</span>
      </li>`
    )
    .join('');

  let heading;
  let intro;
  let outro;

  if (normalisedStatus === 'IN_PRINTING') {
    heading = 'Your order is now being printed';
    intro = `
      <p style="color:#44475a;font-size:14px;line-height:22px;">
        Hi <strong>${buyerName}</strong>,<br><br>
        Good news — your order
        <strong style="color:#2963FF;">${order.orderNumber}</strong>
        is now in production.
      </p>
    `;
    outro =
      "We'll send you another update as soon as your order has been shipped.";
  } else if (normalisedStatus === 'SHIPPED') {
    const trackingLine =
      order.trackingNumber && order.carrier
        ? `<p style="color:#232346;font-size:13px;margin-top:10px;">
             <strong>Carrier:</strong> ${order.carrier}<br>
             <strong>Tracking number:</strong> ${order.trackingNumber}
           </p>`
        : '';

    heading = 'Your order is on the way';
    intro = `
      <p style="color:#44475a;font-size:14px;line-height:22px;">
        Hi <strong>${buyerName}</strong>,<br><br>
        Your order
        <strong style="color:#2963FF;">${order.orderNumber}</strong>
        has now shipped.
      </p>
      ${trackingLine}
    `;
    outro = 'Thanks for ordering from SixByFive TCG!';
  } else {
    // Should not hit for other statuses
    return null;
  }

  const html = emailBase({
    title: 'Order update',
    heading,
    content: `
      ${intro}

      <h4 style="margin:22px 0 10px;font-size:15px;color:#232346;">Order items</h4>
      <ul style="padding:0;margin:0;list-style:none;">
        ${itemsHtml}
      </ul>

      <p style="margin-top:16px;font-size:13px;color:#606480;">
        <strong>Order total:</strong> ${order.total} ${currency}
      </p>
    `,
    outro,
  });

  const subjectSuffix =
    normalisedStatus === 'IN_PRINTING' ? 'is being printed' : 'has shipped';

  return {
    subject: `Update on your order ${order.orderNumber}: ${subjectSuffix}`,
    text: '',
    html,
  };
}

/* -------------------------------------------------------------------------- */
/*  App notification builders                                                 */
/* -------------------------------------------------------------------------- */

function buildBuyerAppNotification(order) {
  if (!order.buyerId) return null;
  const items = getOrderLineItems(order);
  const itemCount = items.reduce((sum, it) => sum + (it.qty || 0), 0);

  return {
    userId: order.buyerId,
    type: 'ORDER_PLACED_BUYER',
    title: 'Order placed',
    body: `Your order ${order.orderNumber} with ${itemCount} item(s) has been created.`,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      listingId: order.listingId,
      listingType: order.listing?.type,
    },
  };
}

function buildSellerAppNotification(order) {
  if (!order.sellerId) return null;
  const items = getOrderLineItems(order);
  const itemCount = items.reduce((sum, it) => sum + (it.qty || 0), 0);

  return {
    userId: order.sellerId,
    type: 'ORDER_PLACED_SELLER',
    title: 'New order received',
    body: `You received a new order ${order.orderNumber} with ${itemCount} item(s).`,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      listingId: order.listingId,
      listingType: order.listing?.type,
    },
  };
}

/**
 * NEW: app notifications for fulfilment stages (buyer-side).
 * Used by sendOrderFulfilmentStatusEmail.
 */
function buildBuyerFulfilmentAppNotification(order, normalisedStatus) {
  if (!order.buyerId) return null;

  let title;
  let body;

  if (normalisedStatus === 'IN_PRINTING') {
    title = 'Order in production';
    body = `Your order ${order.orderNumber} is now being printed.`;
  } else if (normalisedStatus === 'SHIPPED') {
    title = 'Order shipped';
    body = `Your order ${order.orderNumber} is on the way.`;
  } else {
    return null;
  }

  return {
    userId: order.buyerId,
    type: `ORDER_FULFILMENT_${normalisedStatus}`,
    title,
    body,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      fulfilmentStatus: order.fulfilmentStatus,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Discord payload for PRODUCT listings                                      */
/* -------------------------------------------------------------------------- */

function buildProductDiscordPayload(order) {
  const items = getOrderLineItems(order);

  return {
    kind: 'created',
    order,
    items: items.map((item) => ({
      title: item.title,
      qty: item.qty,
      price: item.price,
      currency: item.currency,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export async function sendOrderPlacedNotifications(orderOrId, ctx) {
  const order = await loadOrderWithRelations(orderOrId, ctx);

  // normalise listing type to upper-case so "product", "PRODUCT" etc all work
  const rawType = order.listing?.type || '';
  const listingType = String(rawType).toUpperCase();

  // ---------------- Buyer email + app notification -----------------
  const buyerEmailAddress = getBuyerEmail(order);
  const buyerEmailContent = buildBuyerEmail(order);

  const buyerEmailPromise =
    buyerEmailAddress && buyerEmailContent
      ? sendMail({
          to: buyerEmailAddress,
          subject: buyerEmailContent.subject,
          html: buyerEmailContent.html,
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error(
            '[orderNotificationService] Buyer email failed:',
            err?.message || err
          );
        })
      : Promise.resolve();

  const buyerAppPayload = buildBuyerAppNotification(order);
  const buyerAppPromise = buyerAppPayload
    ? appNotificationService.sendNotification(buyerAppPayload).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(
          '[orderNotificationService] Buyer app notification failed:',
          err?.message || err
        );
      })
    : Promise.resolve();

  // ---------------- Branch by listing type -------------------------

  if (listingType === 'CARD') {
    // CARD: also notify seller by email + app
    const sellerEmailAddress = getSellerEmail(order);
    const sellerEmailContent = buildSellerCardEmail(order);

    const sellerEmailPromise =
      sellerEmailAddress && sellerEmailContent
        ? sendMail({
            to: sellerEmailAddress,
            subject: sellerEmailContent.subject,
            html: sellerEmailContent.html,
          }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error(
              '[orderNotificationService] Seller email failed:',
              err?.message || err
            );
          })
        : Promise.resolve();

    const sellerAppPayload = buildSellerAppNotification(order);
    const sellerAppPromise = sellerAppPayload
      ? appNotificationService.sendNotification(sellerAppPayload).catch((err) => {
          // eslint-disable-next-line no-console
          console.error(
            '[orderNotificationService] Seller app notification failed:',
            err?.message || err
          );
        })
      : Promise.resolve();

    await Promise.all([
      buyerEmailPromise,
      buyerAppPromise,
      sellerEmailPromise,
      sellerAppPromise,
    ]);
    return;
  }

  if (listingType === 'PRODUCT') {
    // PRODUCT: send Discord alert to store owner
    const discordPayload = buildProductDiscordPayload(order);
    const discordPromise = sendOrderNotification(discordPayload).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        '[orderNotificationService] Discord notification failed:',
        err?.message || err
      );
    });

    await Promise.all([buyerEmailPromise, buyerAppPromise, discordPromise]);
    return;
  }

  // Fallback: just buyer notifications
  await Promise.all([buyerEmailPromise, buyerAppPromise]);
}

/**
 * NEW: Fulfilment status notifications (email + app) for buyers.
 *
 * Called from ordersService.adminUpdateOrderFulfilmentStatus with the
 * new fulfilment status. Only sends for:
 *   - in_printing
 *   - shipped
 */
export async function sendOrderFulfilmentStatusEmail(orderOrId, status, ctx) {
  const order = await loadOrderWithRelations(orderOrId, ctx);

  const rawStatus = status || order.fulfilmentStatus || '';
  const normalisedStatus = String(rawStatus).toUpperCase();

  if (!['IN_PRINTING', 'SHIPPED'].includes(normalisedStatus)) {
    // No email for other statuses (processing, completed, cancelled etc.)
    return;
  }

  const buyerEmailAddress = getBuyerEmail(order);
  if (!buyerEmailAddress) {
    // Nothing to send
    return;
  }

  const emailContent = buildFulfilmentStatusBuyerEmail(order, normalisedStatus);
  if (!emailContent) return;

  // Email
  const emailPromise = sendMail({
    to: buyerEmailAddress,
    subject: emailContent.subject,
    html: emailContent.html,
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(
      '[orderNotificationService] Fulfilment email failed:',
      err?.message || err
    );
  });

  // App notification (stub)
  const appPayload = buildBuyerFulfilmentAppNotification(order, normalisedStatus);
  const appPromise = appPayload
    ? appNotificationService.sendNotification(appPayload).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(
          '[orderNotificationService] Fulfilment app notification failed:',
          err?.message || err
        );
      })
    : Promise.resolve();

  await Promise.all([emailPromise, appPromise]);
}
