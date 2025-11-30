// backend/src/modules/marketplace/typeDefs.js
// -----------------------------------------------------------------------------
// Marketplace GraphQL Schema
// -----------------------------------------------------------------------------
// Unified schema for both card and product listings, offers, orders, inventory.
// Now includes separate fulfilment + payment status for orders, and an admin
// orders query + adminUpdateOrderFulfilmentStatus mutation.
// -----------------------------------------------------------------------------

import gql from "graphql-tag";

export default gql`

  # =====================================================
  # ENUMS
  # =====================================================

  enum ListingType {
    CARD
    PRODUCT
  }

  enum ListingStatus {
    active
    sold
    removed
    cancelled
  }

  enum OfferStatus {
    pending
    accepted
    declined
    countered
    withdrawn
    expired
  }

  """
  Legacy / high-level order status.
  Still useful for quick summaries, but backend logic now primarily uses
  paymentStatus + fulfilmentStatus.
  """
  enum OrderStatus {
    pending
    paid
    fulfilled
    completed
    cancelled
    refunded
  }

  # >>> NEW: more granular fulfilment pipeline status
  """
  Fulfilment pipeline for an order (separate from payment).
  """
  enum OrderFulfilmentStatus {
    pending      # order created, not yet picked up by fulfilment
    processing   # in internal queue / being prepared
    in_printing  # POD: being printed / produced
    shipped      # handed to carrier
    completed    # delivered / fulfilment complete
    cancelled    # fulfilment cancelled
  }

  # >>> NEW: payment-specific status
  """
  Payment lifecycle (separate from fulfilment).
  """
  enum OrderPaymentStatus {
    pending      # checkout started but not paid yet
    paid         # successfully paid / captured
    refunded     # refunded (full or partial)
    failed       # payment failed
    cancelled    # payment cancelled / voided
  }

  # =====================================================
  # INTERFACES & BASE TYPES
  # =====================================================

  """
  Shared fields for all marketplace listings.
  """
  interface MarketplaceListing {
    id: ID!
    type: ListingType!
    userId: ID!
    price: Float!
    currency: String!
    quantity: Int!
    allowOffers: Boolean!
    status: ListingStatus!
    createdAt: DateTime
    updatedAt: DateTime
    seller: User!
    buyer: User
    slug: String
  }

  """
  Card listing subtype (user-to-user sales).
  """
  type CardListing implements MarketplaceListing {
    id: ID!
    type: ListingType!
    userId: ID!
    cardId: String
    card: JSON
    quantity: Int!
    price: Float!
    currency: String!
    condition: String
    variation: String
    notes: String
    allowOffers: Boolean!
    status: ListingStatus!
    buyer: User
    seller: User!
    soldAt: DateTime
    shippedAt: DateTime
    completedAt: DateTime
    cancelledAt: DateTime
    cancelledReason: String
    rating: Int
    review: String
    proofCode: String
    proofImage: String
    proofUploadedAt: DateTime
    createdAt: DateTime
    updatedAt: DateTime
    slug: String
  }

  """
  Product listing subtype (official store or digital item).
  """
  type ProductListing implements MarketplaceListing {
    id: ID!
    type: ListingType!
    userId: ID!
    productId: ID
    inventoryId: ID
    title: String
    description: String
    imageUrl: String
    imagesJson: JSON
    colourVariantsJson: JSON
    price: Float!
    currency: String!
    quantity: Int!
    allowOffers: Boolean!
    status: ListingStatus!
    buyer: User
    seller: User!
    inventory: InventoryItem
    createdAt: DateTime
    updatedAt: DateTime
    slug: String

    # Fulfilment-related fields (POD / internal)
    fulfilmentType: String
    fulfilmentProvider: String
    fulfilmentExternalId: String
    fulfilmentMetaJson: JSON
  }

  # =====================================================
  # INVENTORY
  # =====================================================

  type InventoryItem {
    id: ID!
    productId: ID
    listingId: ID
    onHand: Int!
    reserved: Int!
    sold: Int!
    lowStockThreshold: Int
    restockExpectedAt: DateTime
    metadataJson: JSON
    createdAt: DateTime
    updatedAt: DateTime
  }

  # =====================================================
  # OFFERS
  # =====================================================

  type Offer {
    id: ID!
    listingId: ID!
    buyerId: ID!
    buyer: User
    listing: MarketplaceListing
    price: Float!
    counterPrice: Float
    status: OfferStatus!
    metadataJson: JSON
    createdAt: DateTime
    updatedAt: DateTime
  }

  # =====================================================
  # ORDERS
  # =====================================================

  type Order {
    id: ID!

    # Human-friendly reference like SBF-20251125-000123
    orderNumber: String!

    listingId: ID!

    # Nullable for guest checkout
    buyerId: ID
    sellerId: ID

    listing: MarketplaceListing
    buyer: User
    seller: User

    quantity: Int!
    subtotal: Float!
    tax: Float
    shippingCost: Float
    total: Float!
    currency: String!
    paymentMethod: String
    stripeSessionId: String
    stripePaymentIntentId: String

    # Legacy overall status (kept for backwards compatibility / quick filters)
    status: OrderStatus!

    # >>> NEW: granular statuses
    fulfilmentStatus: OrderFulfilmentStatus!
    paymentStatus: OrderPaymentStatus!

    paidAt: DateTime
    fulfilledAt: DateTime
    shippedAt: DateTime
    completedAt: DateTime
    cancelledAt: DateTime
    cancelledReason: String
    refundedAt: DateTime
    refundAmount: Float

    shippingAddressJson: JSON
    trackingNumber: String
    carrier: String
    shippingLabelUrl: String

    # Guest checkout fields
    guestCheckout: Boolean!
    buyerEmail: String
    buyerName: String

    buyerRating: Int
    buyerReview: String
    metadataJson: JSON
    createdAt: DateTime
    updatedAt: DateTime
  }

  type CreateOrderResponse {
    order: Order!
    checkoutUrl: String
  }

  # =====================================================
  # INPUT TYPES
  # =====================================================

  input CardListingInput {
    cardId: String!
    price: Float!
    currency: String
    quantity: Int
    condition: String
    variation: String
    notes: String
    allowOffers: Boolean
  }

  """
  Input for creating a product listing.
  Used by both public mutations and admin dashboard.
  """
  input ProductListingInput {
    title: String!
    description: String
    price: Float!
    currency: String
    quantity: Int
    imageUrl: String
    inventoryId: ID
    imagesJson: JSON
    colourVariantsJson: JSON

    # fulfilment fields so admin dashboard can wire POD/internal
    fulfilmentType: String
    fulfilmentProvider: String
    fulfilmentExternalId: String
    fulfilmentMetaJson: JSON
  }

  """
  Input for updating an existing listing that the current user owns.
  All fields are optional; only provided fields will be changed.
  Used by the updateMyListing mutation.
  """
  input ListingUpdateInput {
    # Shared fields
    title: String
    description: String
    price: Float
    currency: String
    quantity: Int
    allowOffers: Boolean
    status: ListingStatus

    # Media (mostly for PRODUCT)
    imageUrl: String
    imagesJson: JSON
    colourVariantsJson: JSON

    # Card-specific fields
    condition: String
    variation: String
    notes: String

    # Fulfilment (primarily PRODUCT listings)
    fulfilmentType: String
    fulfilmentProvider: String
    fulfilmentExternalId: String
    fulfilmentMetaJson: JSON
  }

  input OfferInput {
    listingId: ID!
    price: Float!
  }

  """
  Original order input used by createOrder.
  Still supported for now; createOrderFromListing is the newer, guest-aware flow.
  """
  input OrderInput {
    listingId: ID!
    quantity: Int!
    shippingAddressJson: JSON
    paymentMethod: String
  }

  # Structured shipping address for the new checkout flow
  input ShippingAddressInput {
    line1: String!
    line2: String
    city: String!
    region: String
    postalCode: String!
    country: String!
  }

  # Guest-aware order creation input
  input CreateOrderFromListingInput {
    listingId: ID!
    quantity: Int = 1

    # Guest checkout toggle.
    # - If true: buyerEmail is REQUIRED.
    # - If false: we expect a logged-in user in context.
    guestCheckout: Boolean = false

    # For guests: REQUIRED email, optional name.
    # For logged-in users: can override default email/name if desired.
    buyerEmail: String
    buyerName: String

    shippingAddress: ShippingAddressInput!
  }

  # =====================================================
  # QUERIES
  # =====================================================

  type Query {

    # Listings
    listings(
      type: ListingType
      status: ListingStatus
      limit: Int
      offset: Int
    ): [MarketplaceListing!]!

    listing(id: ID!): MarketplaceListing

    # Offers
    offersByUser(userId: ID!): [Offer!]!
    offersForListing(listingId: ID!): [Offer!]!

    # Orders
    ordersByUser(userId: ID!): [Order!]!
    order(id: ID!): Order

    # Admin / inventory
    inventoryItems(limit: Int, offset: Int): [InventoryItem!]!

    # >>> NEW: admin-wide orders listing
    """
    Admin-only: list orders across the whole marketplace.
    You can later add filters by status / fulfilmentStatus / paymentStatus.
    """
    adminOrders(
      status: OrderStatus
      fulfilmentStatus: OrderFulfilmentStatus
      paymentStatus: OrderPaymentStatus
      listingType: ListingType
      limit: Int = 50
      offset: Int = 0
    ): [Order!]!
  }

  # =====================================================
  # MUTATIONS
  # =====================================================

  type Mutation {

    # Listings
    createCardListing(input: CardListingInput!): CardListing!
    createProductListing(input: ProductListingInput!): ProductListing!

    # Admin-only entry point for dashboard product creation
    adminCreateProductListing(input: ProductListingInput!): ProductListing!

    # Admin product editing (POD / merch etc.)
    adminUpdateProductListing(id: ID!, input: ProductListingInput!): ProductListing!

    # Seller-owned listing management
    updateMyListing(id: ID!, input: ListingUpdateInput!): MarketplaceListing!
    removeMyListing(id: ID!): Boolean!

    updateListingStatus(id: ID!, status: ListingStatus!): MarketplaceListing!
    deleteListing(id: ID!): Boolean!

    # Offers
    createOffer(input: OfferInput!): Offer!
    respondToOffer(offerId: ID!, status: OfferStatus!, counterPrice: Float): Offer!

    # Orders (legacy-style flow)
    createOrder(input: OrderInput!): CreateOrderResponse!
    markOrderFulfilled(orderId: ID!): Order!
    cancelOrder(orderId: ID!, reason: String): Order!

    # Guest-aware, cleaner order creation flow
    createOrderFromListing(input: CreateOrderFromListingInput!): Order!

    # Inventory
    adjustInventory(inventoryId: ID!, onHand: Int, reserved: Int, sold: Int): InventoryItem!

    # >>> NEW: admin fulfilment status update
    """
    Admin-only: update the fulfilment status of an order.
    This will also send notification emails on key transitions:
    - PROCESSING -> IN_PRINTING (email to buyer)
    - any -> SHIPPED (email to buyer)
    """
    adminUpdateOrderFulfilmentStatus(
      orderId: ID!
      status: OrderFulfilmentStatus!
    ): Order!
  }

  # =====================================================
  # INTERFACE RESOLVERS
  # =====================================================

  # The backend resolvers.js file will contain a __resolveType for MarketplaceListing

`;
