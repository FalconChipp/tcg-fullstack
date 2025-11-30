import {
  requireAuth,
  isAdminLike,
  assertPositiveInt,
  assertPositivePrice,
  sanitizeLimitOffset,
} from "../utils/validationUtils.js";

import { ALLOWED_LISTING_STATUSES } from "../utils/listingUtils.js";

/* ----------------------------- Helper Utils -------------------------------- */

/**
 * Very simple UUID v4-ish checker.
 * Used to decide whether the incoming identifier is a primary-key UUID
 * or a slug (e.g. "test-product").
 */
function looksLikeUuid(value) {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

/**
 * Generate a URL-safe slug from a title.
 * Example: "Test Product!!  " -> "test-product"
 */
function slugifyTitle(title) {
  const base = String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // spaces & junk → "-"
    .replace(/^-+|-+$/g, ""); // trim leading/trailing "-"

  return base || null;
}

/* ----------------------------- Data Mappers -------------------------------- */

/**
 * Lightweight includes to enrich records without overfetching.
 * Nested GraphQL field resolvers fetch details as needed.
 */
function getIncludeOptions(models) {
  const { User } = models;
  return [
    { model: User, as: "seller", attributes: ["id", "username", "email"] },
    { model: User, as: "buyer", attributes: ["id", "username", "email"] },
  ];
}

/* ----------------------------- Update Helpers ------------------------------ */

/**
 * Normalise imagesJson / colourVariantsJson for updates.
 * If the field is provided:
 *   - non-empty array -> keep
 *   - anything else   -> null
 */
function applyImagesUpdate(listing, input) {
  if ("imagesJson" in input) {
    const v = input.imagesJson;
    if (Array.isArray(v) && v.length) listing.imagesJson = v;
    else listing.imagesJson = null;
  }

  if ("colourVariantsJson" in input) {
    const v = input.colourVariantsJson;
    if (Array.isArray(v) && v.length) listing.colourVariantsJson = v;
    else listing.colourVariantsJson = null;
  }
}

/**
 * Apply fulfilment-related updates for PRODUCT listings.
 * For updates we:
 *  - Respect explicit fulfilmentType if provided
 *  - Otherwise leave existing fulfilmentType as-is
 *  - Allow provider / externalId / metaJson to be updated/cleared
 */
function applyFulfilmentUpdate(listing, input) {
  if ("fulfilmentType" in input && input.fulfilmentType) {
    listing.fulfilmentType = input.fulfilmentType;
  }

  if ("fulfilmentProvider" in input) {
    listing.fulfilmentProvider = input.fulfilmentProvider || null;
  }

  if ("fulfilmentExternalId" in input) {
    listing.fulfilmentExternalId = input.fulfilmentExternalId || null;
  }

  if ("fulfilmentMetaJson" in input) {
    listing.fulfilmentMetaJson = input.fulfilmentMetaJson || null;
  }
}

/**
 * NEW: Normalise / enrich fulfilmentMetaJson for PRODUCT listings,
 * especially POD (Inkthreadables) products.
 *
 * - Keeps any keys sent from the admin UI.
 * - For fulfilmentType === "POD", ensures we have a coherent object with
 *   at least:
 *     - productType (default "CLOTHING")
 *     - productCode (e.g. "STSU168")
 *     - colourCode (e.g. "BLK")
 *     - colourName (e.g. "Black")
 *     - sizeLabel (e.g. "M")
 *     - designFrontUrl / designBackUrl (if provided)
 *
 * The Inkthreadables integration then uses this to derive PN and the
 * designs payload.
 */
function buildFulfilmentMetaForCreate(input, fulfilmentType) {
  const incoming = input?.fulfilmentMetaJson;

  // If nothing is provided and it's not POD, just return null.
  if (!incoming && fulfilmentType !== "POD") {
    return null;
  }

  // Start with an object if we have one; otherwise for POD start empty.
  let meta =
    incoming && typeof incoming === "object"
      ? { ...incoming }
      : fulfilmentType === "POD"
      ? {}
      : null;

  if (!meta) {
    // Non-POD and no meta → leave null.
    return null;
  }

  if (fulfilmentType === "POD") {
    // Ensure sensible defaults for POD listings
    if (!meta.productType) {
      meta.productType = "CLOTHING";
    }

    // Allow these to be supplied either in fulfilmentMetaJson
    // or top-level input (admin UI convenience).
    meta.productCode = meta.productCode || input?.productCode || null;
    meta.colourCode = meta.colourCode || input?.colourCode || null;
    meta.colourName = meta.colourName || input?.colourName || null;
    meta.sizeLabel = meta.sizeLabel || input?.sizeLabel || null;

    // Design URLs (front/back) – admin UI is expected to set these, but
    // we also map through from top-level if present.
    meta.designFrontUrl =
      meta.designFrontUrl || input?.designFrontUrl || null;
    meta.designBackUrl = meta.designBackUrl || input?.designBackUrl || null;

    // Optional mockups – your Inkthreadables call can choose to use them
    // or not. We simply persist them here if provided.
    meta.mockupFrontUrl =
      meta.mockupFrontUrl || input?.mockupFrontUrl || null;
    meta.mockupBackUrl =
      meta.mockupBackUrl || input?.mockupBackUrl || null;
  }

  return meta;
}

/* -------------------------------- Service ---------------------------------- */

const listingsService = {
  /* ============================== Listings =============================== */

  async getListings(args, ctx) {
    const { Listing } = ctx.models;
    const { type, status } = args || {};
    const { limit, offset } = sanitizeLimitOffset(args || {});

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const results = await Listing.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      include: getIncludeOptions(ctx.models),
    });

    return results;
  },

  /**
   * Fetch a listing by either:
   *  - UUID primary key (existing behaviour)
   *  - slug (new behaviour, e.g. "test-product")
   *
   * This allows the GraphQL field `listing(id: ID!)` to accept
   * either the UUID or the slug string.
   */
  async getListingById(idOrSlug, ctx) {
    const { Listing } = ctx.models;

    if (!idOrSlug) {
      throw new Error("Listing id is required");
    }

    let listing;

    if (looksLikeUuid(idOrSlug)) {
      // Existing path: lookup by primary key
      listing = await Listing.findByPk(idOrSlug, {
        include: getIncludeOptions(ctx.models),
      });
    } else {
      // New path: lookup by slug
      listing = await Listing.findOne({
        where: { slug: idOrSlug },
        include: getIncludeOptions(ctx.models),
      });
    }

    if (!listing) throw new Error("Listing not found");
    return listing;
  },

  async createCardListing(input, ctx) {
    const user = requireAuth(ctx);
    const { Listing } = ctx.models;

    // Validate required fields
    if (!input?.cardId) throw new Error("cardId is required");
    assertPositivePrice(input.price);
    const quantity = Number.isInteger(input?.quantity) ? input.quantity : 1;
    assertPositiveInt(quantity, "quantity");

    // Optional: hook to a Collections module to verify user owns the card

    const listing = await Listing.create({
      type: "CARD",
      userId: user.id,
      cardId: input.cardId,
      condition: input?.condition || null,
      variation: input?.variation || null,
      notes: input?.notes || null,
      quantity,
      price: input.price,
      currency: input?.currency || "GBP",
      allowOffers: input?.allowOffers ?? true,
      status: "active",
      // NOTE: you *could* also generate a slug for card listings here
      // (e.g. based on cardId/variation), but leaving as-is for now.
    });

    return this.getListingById(listing.id, ctx);
  },

  async createProductListing(input, ctx) {
    const user = requireAuth(ctx);
    if (!isAdminLike(user)) {
      throw new Error("Only admins/staff can create product listings");
    }

    const { Listing, InventoryItem } = ctx.models;

    // Validate required fields
    if (!input?.title) throw new Error("title is required");
    assertPositivePrice(input.price);
    const quantity = Number.isInteger(input?.quantity) ? input.quantity : 1;
    assertPositiveInt(quantity, "quantity");

    // Validate inventory link if provided
    let inventoryId = input?.inventoryId || null;
    if (inventoryId) {
      const inv = await InventoryItem.findByPk(inventoryId);
      if (!inv) throw new Error("inventoryId does not exist");
    }

    // Normalise arrays (we expect arrays from the admin UI)
    const imagesJson =
      Array.isArray(input?.imagesJson) && input.imagesJson.length
        ? input.imagesJson
        : null;

    const colourVariantsJson =
      Array.isArray(input?.colourVariantsJson) &&
      input.colourVariantsJson.length
        ? input.colourVariantsJson
        : null;

    // NEW: extract productType (used for fulfilmentType inference only)
    const productType = input?.productType || null; // NEW

    // NEW: generate a slug from the title for human-readable URLs
    const slug = slugifyTitle(input.title);

    /**
     * Derive fulfilmentType based on product type/category
     * ------------------------------------------------------------------
     * Goal:
     *   - Clothing  -> POD (print-on-demand)
     *   - 3D print  -> INTERNAL (your own fulfilment)
     *
     * Priority:
     *   1. If input.fulfilmentType is explicitly provided -> respect it.
     *   2. Else if productType === "CLOTHING"            -> "POD".
     *   3. Else if productType === "3D_PRINT"            -> "INTERNAL".
     *   4. Else                                         -> "INTERNAL".
     */
    let fulfilmentType; // CHANGED: keep as let for meta logic below

    if (input?.fulfilmentType) {
      // Admin explicitly chose POD/INTERNAL – respect that
      fulfilmentType = input.fulfilmentType;
    } else if (productType === "CLOTHING") {
      fulfilmentType = "POD";
    } else if (productType === "3D_PRINT") {
      fulfilmentType = "INTERNAL";
    } else {
      fulfilmentType = "INTERNAL";
    }

    // NEW: auto-set provider for POD listings unless explicitly provided
    let fulfilmentProvider =
      input?.fulfilmentProvider ||
      (fulfilmentType === "POD" ? "INKTHREADABLES" : null); // NEW

    // NEW: normalise / enrich fulfilmentMetaJson for this listing
    const fulfilmentMetaJson = buildFulfilmentMetaForCreate(
      input,
      fulfilmentType
    ); // NEW

    const listing = await Listing.create({
      type: "PRODUCT",
      userId: user.id,
      productId: input?.productId || null,
      inventoryId,
      title: input.title,
      description: input?.description || null,
      imageUrl: input?.imageUrl || null,

      // NEW: slug for /marketplace/<slug>
      slug,

      // JSON-like metadata
      imagesJson,
      colourVariantsJson,

      quantity,
      price: input.price,
      currency: input?.currency || "GBP",
      allowOffers: input?.allowOffers ?? true,

      // fulfilment-related (now using derived fulfilmentType + provider + meta)
      fulfilmentType,
      fulfilmentProvider, // CHANGED: use local var
      fulfilmentExternalId: input?.fulfilmentExternalId || null,
      fulfilmentMetaJson, // CHANGED: use built meta (may be null or object)

      status: "active",
    });

    return this.getListingById(listing.id, ctx);
  },

  /**
   * ADMIN: update an existing PRODUCT listing (title, description, pricing,
   * inventory, fulfilment, images, etc.).
   * Used by the admin dashboard.
   */
  async adminUpdateProductListing(id, input, ctx) {
    const user = requireAuth(ctx);
    if (!isAdminLike(user)) {
      throw new Error("Only admins/staff can edit product listings");
    }

    const { Listing, InventoryItem } = ctx.models;

    const listing = await Listing.findByPk(id);
    if (!listing) throw new Error("Listing not found");
    if (listing.type !== "PRODUCT") {
      throw new Error("adminUpdateProductListing can only edit PRODUCT listings");
    }

    // Optional validations
    if ("price" in input && input.price != null) {
      assertPositivePrice(input.price);
    }
    if ("quantity" in input && input.quantity != null) {
      assertPositiveInt(input.quantity, "quantity");
    }

    if ("inventoryId" in input) {
      const inventoryId = input.inventoryId || null;
      if (inventoryId) {
        const inv = await InventoryItem.findByPk(inventoryId);
        if (!inv) throw new Error("inventoryId does not exist");
      }
      listing.inventoryId = input.inventoryId || null;
    }

    // Core fields
    if ("title" in input && input.title) {
      listing.title = input.title;
      listing.slug = slugifyTitle(input.title) || listing.slug;
    }
    if ("description" in input) {
      listing.description = input.description || null;
    }
    if ("imageUrl" in input) {
      listing.imageUrl = input.imageUrl || null;
    }

    // Money / quantity / offers
    if ("price" in input && input.price != null) {
      listing.price = input.price;
    }
    if ("currency" in input && input.currency) {
      listing.currency = input.currency;
    }
    if ("quantity" in input && input.quantity != null) {
      listing.quantity = input.quantity;
    }
    if ("allowOffers" in input && typeof input.allowOffers === "boolean") {
      listing.allowOffers = input.allowOffers;
    }

    // Images / variants
    applyImagesUpdate(listing, input);

    // Fulfilment details
    applyFulfilmentUpdate(listing, input);

    await listing.save();
    return this.getListingById(listing.id, ctx);
  },

  /**
   * SELLER: update their own listing.
   * - For CARD listings: allow editing price, quantity, condition, variation, notes, allowOffers, currency
   * - For PRODUCT listings: by default we only allow price/quantity/allowOffers via this path
   *   (heavier edits go through adminUpdateProductListing).
   */
  async updateMyListing(id, input, ctx) {
    const user = requireAuth(ctx);
    const { Listing } = ctx.models;

    const listing = await Listing.findByPk(id);
    if (!listing) throw new Error("Listing not found");

    if (listing.userId !== user.id) {
      throw new Error("You are not allowed to edit this listing");
    }

    if (["sold", "cancelled", "removed"].includes(listing.status)) {
      throw new Error("You cannot edit a listing that is sold/cancelled/removed");
    }

    // Common validations
    if ("price" in input && input.price != null) {
      assertPositivePrice(input.price);
    }
    if ("quantity" in input && input.quantity != null) {
      assertPositiveInt(input.quantity, "quantity");
    }

    if (listing.type === "CARD") {
      // Card-specific fields the seller can change
      if ("condition" in input) {
        listing.condition = input.condition || null;
      }
      if ("variation" in input) {
        listing.variation = input.variation || null;
      }
      if ("notes" in input) {
        listing.notes = input.notes || null;
      }
      if ("price" in input && input.price != null) {
        listing.price = input.price;
      }
      if ("currency" in input && input.currency) {
        listing.currency = input.currency;
      }
      if ("quantity" in input && input.quantity != null) {
        listing.quantity = input.quantity;
      }
      if ("allowOffers" in input && typeof input.allowOffers === "boolean") {
        listing.allowOffers = input.allowOffers;
      }
    } else if (listing.type === "PRODUCT") {
      // For now, keep seller-level product edits minimal:
      // price / quantity / allowOffers. All other fields are admin-only.
      if ("price" in input && input.price != null) {
        listing.price = input.price;
      }
      if ("currency" in input && input.currency) {
        listing.currency = input.currency;
      }
      if ("quantity" in input && input.quantity != null) {
        listing.quantity = input.quantity;
      }
      if ("allowOffers" in input && typeof input.allowOffers === "boolean") {
        listing.allowOffers = input.allowOffers;
      }
    }

    await listing.save();
    return this.getListingById(listing.id, ctx);
  },

  /**
   * SELLER: remove their own listing (soft delete -> status = removed).
   * This is what you'll call from the "Delete listing" button in the UI
   * for normal users. Admins can still use deleteListing.
   */
  async removeMyListing(id, ctx) {
    const user = requireAuth(ctx);
    const { Listing, Offer } = ctx.models;

    const listing = await Listing.findByPk(id);
    if (!listing) throw new Error("Listing not found");

    if (listing.userId !== user.id) {
      throw new Error("You are not allowed to remove this listing");
    }

    if (listing.status === "sold") {
      throw new Error("You cannot remove a listing that has already been sold");
    }

    // Soft delete via status
    listing.status = "removed";
    await listing.save();

    // Withdraw all pending offers on this listing
    await Offer.update(
      { status: "withdrawn" },
      { where: { listingId: id, status: "pending" } }
    );

    return true;
  },

  async updateListingStatus(id, nextStatus, ctx) {
    const user = requireAuth(ctx);
    const { Listing } = ctx.models;

    const listing = await Listing.findByPk(id);
    if (!listing) throw new Error("Listing not found");

    // Only seller or admin can mutate listing
    if (listing.userId !== user.id && !isAdminLike(user)) {
      throw new Error("You are not allowed to modify this listing");
    }

    if (!ALLOWED_LISTING_STATUSES.includes(nextStatus)) {
      throw new Error(
        `Invalid status. Allowed: ${ALLOWED_LISTING_STATUSES.join(", ")}`
      );
    }

    // Prevent re-activating sold listings without admin
    if (
      listing.status === "sold" &&
      nextStatus === "active" &&
      !isAdminLike(user)
    ) {
      throw new Error("Only admins can re-activate a sold listing");
    }

    listing.status = nextStatus;
    if (nextStatus === "sold") listing.soldAt = new Date();
    if (nextStatus === "cancelled") listing.cancelledAt = new Date();

    await listing.save();
    return this.getListingById(listing.id, ctx);
  },

  async deleteListing(id, ctx) {
    const user = requireAuth(ctx);
    const { Listing, Offer } = ctx.models;

    const listing = await Listing.findByPk(id);
    if (!listing) throw new Error("Listing not found");
    if (listing.userId !== user.id && !isAdminLike(user)) {
      throw new Error("You are not allowed to modify this listing");
    }

    // Soft-delete via status for auditability
    listing.status = "removed";
    await listing.save();

    // Withdraw all pending offers on this listing
    await Offer.update(
      { status: "withdrawn" },
      { where: { listingId: id, status: "pending" } }
    );

    return true;
  },

  /* ================================ Offers ================================ */

  async getOffersByUser(userId, ctx) {
    const { Offer, Listing } = ctx.models;
    return Offer.findAll({
      where: { buyerId: userId },
      order: [["createdAt", "DESC"]],
      include: [{ model: Listing, as: "listing" }],
    });
  },

  async getOffersForListing(listingId, ctx) {
    const { Offer, Listing } = ctx.models;
    return Offer.findAll({
      where: { listingId },
      order: [["createdAt", "DESC"]],
      include: [{ model: Listing, as: "listing" }],
    });
  },

  async createOffer(input, ctx) {
    const user = requireAuth(ctx);
    const { Offer, Listing } = ctx.models;

    if (!input?.listingId) throw new Error("listingId is required");
    assertPositivePrice(input?.price, "offer price");

    const listing = await Listing.findByPk(input.listingId);
    if (!listing) throw new Error("Listing not found");
    if (!listing.allowOffers) throw new Error("Offers are disabled for this listing");
    if (listing.status !== "active") {
      throw new Error("Cannot offer on an inactive listing");
    }
    if (listing.userId === user.id) {
      throw new Error("You cannot offer on your own listing");
    }

    const offer = await Offer.create({
      listingId: input.listingId,
      buyerId: user.id,
      price: input.price,
      status: "pending",
      metadataJson: null,
    });

    return offer;
  },

  async respondToOffer(offerId, status, counterPrice, ctx) {
    const user = requireAuth(ctx);
    const { Offer, Listing } = ctx.models;

    const offer = await Offer.findByPk(offerId);
    if (!offer) throw new Error("Offer not found");

    const listing = await Listing.findByPk(offer.listingId);
    if (!listing) throw new Error("Listing not found");

    // Only the listing owner (seller) or admin can respond
    if (listing.userId !== user.id && !isAdminLike(user)) {
      throw new Error("You are not allowed to modify this listing");
    }

    const allowed = ["accepted", "declined", "countered", "withdrawn"];
    if (!allowed.includes(status)) {
      throw new Error(`Invalid offer status. Allowed: ${allowed.join(", ")}`);
    }

    if (status === "countered") {
      assertPositivePrice(counterPrice, "counterPrice");
      offer.counterPrice = counterPrice;
    }

    offer.status = status;
    await offer.save();

    return offer;
  },

  /* ============================= Field Helpers ============================ */

  async getUser(userId, ctx) {
    const { User } = ctx.models;
    if (!userId) return null;
    return User.findByPk(userId);
  },

  async getCardData(cardId, ctx) {
    const { m_Card } = ctx.models;
    if (!cardId || !m_Card) return null;
    return m_Card.findByPk(cardId);
  },
};

export default listingsService;
