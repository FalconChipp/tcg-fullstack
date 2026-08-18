import { gql } from '@apollo/client';

// ─── Users ────────────────────────────────────────────────────────────────────

export const ADMIN_USERS_QUERY = gql`
  query AdminUsers($limit: Int) {
    allUsers(limit: $limit) {
      id username email isAdmin isBanned emailVerified createdAt lastLogin
      profile { country status favouritePokemon }
    }
  }
`;

// ─── Binders ──────────────────────────────────────────────────────────────────

export const ADMIN_BINDERS_QUERY = gql`
  query AdminBinders {
    adminBinders { id userId name visibility isDeleted createdAt }
  }
`;

export const ADMIN_DELETE_BINDER = gql`
  mutation AdminDeleteBinder($id: ID!) {
    adminDeleteBinder(id: $id)
  }
`;

// ─── Cards / Collections ──────────────────────────────────────────────────────

export const ADMIN_USER_COLLECTIONS_QUERY = gql`
  query AdminUserCollections($limit: Int, $search: String) {
    adminUserCollections(limit: $limit, search: $search) {
      userId username email totalCards distinctCards
    }
  }
`;

// ─── Listings ─────────────────────────────────────────────────────────────────

export const ADMIN_LISTINGS_QUERY = gql`
  query AdminListings($status: String, $limit: Int, $offset: Int) {
    adminListings(status: $status, limit: $limit, offset: $offset) {
      id cardId title sellerId price quantity condition status createdAt
    }
  }
`;

export const ADMIN_DELETE_CARD_LISTING = gql`
  mutation AdminDeleteListing($id: ID!) {
    deleteListing(id: $id)
  }
`;

// ─── Product listings ─────────────────────────────────────────────────────────

export const ADMIN_PRODUCT_LISTINGS_QUERY = gql`
  query AdminProductListings($limit: Int, $offset: Int, $status: ListingStatus) {
    listings(type: PRODUCT, status: $status, limit: $limit, offset: $offset) {
      __typename
      ... on ProductListing {
        id title description imageUrl price currency quantity status
        fulfilmentType fulfilmentProvider fulfilmentExternalId
        imagesJson colourVariantsJson createdAt
      }
    }
  }
`;

export const ADMIN_CREATE_PRODUCT_LISTING = gql`
  mutation AdminCreateProductListing($input: ProductListingInput!) {
    adminCreateProductListing(input: $input) {
      id title description price currency quantity status
      fulfilmentType fulfilmentProvider fulfilmentExternalId
      imagesJson colourVariantsJson createdAt
    }
  }
`;

export const ADMIN_UPDATE_PRODUCT_LISTING = gql`
  mutation AdminUpdateProductListing($id: ID!, $input: ProductListingInput!) {
    adminUpdateProductListing(id: $id, input: $input) {
      id title description price currency quantity status
      fulfilmentType fulfilmentProvider fulfilmentExternalId
      imageUrl imagesJson colourVariantsJson createdAt
    }
  }
`;

export const ADMIN_DELETE_PRODUCT_LISTING = gql`
  mutation DeleteListing($id: ID!) {
    deleteListing(id: $id)
  }
`;

// ─── Notifications ────────────────────────────────────────────────────────────

export const ADMIN_SEND_BROADCAST = gql`
  mutation AdminSendBroadcastNotification($input: BroadcastNotificationInput!) {
    adminSendBroadcastNotification(input: $input)
  }
`;

// ─── Orders & Disputes ────────────────────────────────────────────────────────

export const ADMIN_ORDERS_QUERY = gql`
  query AdminOrders($limit: Int, $offset: Int) {
    adminOrders(limit: $limit, offset: $offset) {
      id orderNumber createdAt fulfilmentStatus paymentStatus
      totalAmount currency buyerEmail shippingAddressJson
      buyer { id username }
      seller { id username }
      listing {
        __typename
        ... on ProductListing { id title fulfilmentType }
        ... on CardListing { id cardId condition variation }
      }
    }
  }
`;

export const ADMIN_UPDATE_FULFILMENT = gql`
  mutation AdminUpdateOrderFulfilmentStatus($orderId: ID!, $status: String!) {
    adminUpdateOrderFulfilmentStatus(orderId: $orderId, status: $status) {
      id fulfilmentStatus
    }
  }
`;

export const ADMIN_DISPUTES_QUERY = gql`
  query AdminOrderDisputes($status: String) {
    adminOrderDisputes(status: $status) {
      id orderId raisedBy reason status resolution
      resolvedInFavourOf escrowActionTaken resolvedAt createdAt
    }
  }
`;

export const ADMIN_RESOLVE_DISPUTE = gql`
  mutation AdminResolveDispute($id: ID!, $resolution: String!, $resolvedInFavourOf: String!) {
    adminResolveDispute(id: $id, resolution: $resolution, resolvedInFavourOf: $resolvedInFavourOf)
  }
`;

// ─── Proof queue ──────────────────────────────────────────────────────────────

export const ADMIN_PROOF_QUEUE_QUERY = gql`
  query AdminProofQueue {
    adminProofQueue {
      id cardId title condition variation price currency
      proofCode moderationResult proofImagePath createdAt
      seller { id username }
    }
  }
`;

export const ADMIN_APPROVE_PROOF = gql`
  mutation AdminApproveProof($id: ID!) {
    adminApproveProof(id: $id)
  }
`;

export const ADMIN_REJECT_PROOF = gql`
  mutation AdminRejectProof($id: ID!, $reason: String) {
    adminRejectProof(id: $id, reason: $reason)
  }
`;

// ─── Reported users ───────────────────────────────────────────────────────────

export const ADMIN_CLEAR_REPORT = gql`
  mutation AdminClearUserReport($userId: ID!) {
    adminClearUserReport(userId: $userId)
  }
`;

export const ADMIN_BAN_FROM_CHAT = gql`
  mutation AdminBanUserFromChat($userId: ID!, $reason: String) {
    adminBanUserFromChat(userId: $userId, reason: $reason)
  }
`;

export const ADMIN_UNBAN_CHAT = gql`
  mutation AdminUnbanUserFromChat($userId: ID!) {
    adminUnbanUserFromChat(userId: $userId)
  }
`;

export const ADMIN_SEND_SYSTEM_MESSAGE = gql`
  mutation AdminSendSystemMessage($receiverId: ID!, $content: String!, $meta: JSON) {
    adminSendSystemMessage(receiverId: $receiverId, content: $content, meta: $meta)
  }
`;

// ─── Revenue ──────────────────────────────────────────────────────────────────

export const ADMIN_REVENUE_SUMMARY_QUERY = gql`
  query AdminRevenueSummary {
    adminRevenueSummary {
      totalRevenue revenue30d revenue7d subRevenue productRevenue refunds currency
    }
    adminMarketplaceRevenue {
      gmv platformFees shippingCollected walletUsed refundedTotal stripeFeeEstimate
      gmv30d gmv7d platformFees30d totalOrders completedOrders
      openDisputes resolvedDisputes
      monthly { month gmv fees orders }
      currency
    }
  }
`;

export const ADMIN_TRANSACTIONS_QUERY = gql`
  query AdminAllTransactions($page: Int, $pageSize: Int, $type: String) {
    adminAllTransactions(page: $page, pageSize: $pageSize, type: $type) {
      total
      transactions {
        id userId type amount currency status description stripePaymentIntentId createdAt
      }
    }
  }
`;

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const ADMIN_REVIEW_QUEUE_QUERY = gql`
  query AdminReviewQueue($status: String, $limit: Int, $offset: Int) {
    adminReviewQueue(status: $status, limit: $limit, offset: $offset) {
      id sellerId cardId rating review reviewStatus disputeReason updatedAt
    }
  }
`;

export const ADMIN_RESOLVE_REVIEW = gql`
  mutation AdminResolveReview($listingId: ID!, $action: String!) {
    adminResolveReview(listingId: $listingId, action: $action)
  }
`;

// ─── Subscriptions & Plans ────────────────────────────────────────────────────

export const ADMIN_SUBSCRIPTIONS_QUERY = gql`
  query AdminSubscriptions($status: String, $page: Int, $pageSize: Int) {
    adminSubscriptions(status: $status, page: $page, pageSize: $pageSize) {
      total page pageSize
      subscriptions {
        id userId status cancelAtPeriodEnd currentPeriodStart currentPeriodEnd
        cancelledAt stripeSubscriptionId createdAt
        plan { id name price interval }
      }
    }
  }
`;

export const ADMIN_PLANS_QUERY = gql`
  query AdminPlans {
    adminPlans {
      id name price interval active
      platformFeePercent maxBinders maxActiveListings maxActiveTrades
    }
  }
`;

export const ADMIN_CANCEL_SUB = gql`
  mutation AdminCancelSub($id: ID!) {
    adminCancelSubscription(id: $id)
  }
`;

export const ADMIN_RESUME_SUB = gql`
  mutation AdminResumeSub($id: ID!) {
    adminResumeSubscription(id: $id)
  }
`;

export const ADMIN_CHANGE_PLAN = gql`
  mutation AdminChangePlan($id: ID!, $planId: ID!) {
    adminChangePlan(id: $id, planId: $planId)
  }
`;

export const ADMIN_GRANT_SUB = gql`
  mutation AdminGrantSub($userId: ID!, $planId: ID!, $periodDays: Int) {
    adminGrantSubscription(userId: $userId, planId: $planId, periodDays: $periodDays)
  }
`;

export const ADMIN_REVOKE_SUB = gql`
  mutation AdminRevokeSub($id: ID!) {
    adminRevokeSubscription(id: $id)
  }
`;

export const ADMIN_UPDATE_PLAN = gql`
  mutation AdminUpdatePlan($id: ID!, $input: PlanInput!) {
    adminUpdatePlan(id: $id, input: $input) {
      id name price interval active
      platformFeePercent maxBinders maxActiveListings maxActiveTrades
    }
  }
`;

// ─── Trade moderation (plain strings for gqlFetch — not Apollo) ───────────────

export const ADMIN_TRADES_QUERY = `
  query AdminTrades($page: Int, $pageSize: Int, $status: TradeStatus, $userId: ID) {
    adminTrades(page: $page, pageSize: $pageSize, status: $status, userId: $userId) {
      id partyAId partyBId status counterCount topUpAmount
      createdAt completedAt cancelledAt cancelledReason disputeId adminNotes
    }
  }
`;

export const ADMIN_TRADE_DISPUTES_QUERY = `
  query AdminTradeDisputes($status: String) {
    adminTradeDisputes(status: $status) {
      id tradeId raisedById reason status resolution resolvedAt createdAt
    }
  }
`;

export const ADMIN_TRADE_BANS_QUERY = `
  query AdminTradeBans {
    adminTradeBans {
      userId reason bannedBy bannedAt
    }
  }
`;

export const ADMIN_RESOLVE_TRADE_DISPUTE = `
  mutation AdminResolveTradeDispute($id: ID!, $resolution: String!, $resolvedInFavourOf: String) {
    adminResolveTradeDispute(id: $id, resolution: $resolution, resolvedInFavourOf: $resolvedInFavourOf) {
      id status
    }
  }
`;

export const ADMIN_BAN_FROM_TRADING = `
  mutation AdminBanUserFromTrading($userId: ID!, $reason: String) {
    adminBanUserFromTrading(userId: $userId, reason: $reason)
  }
`;

export const ADMIN_UNBAN_FROM_TRADING = `
  mutation AdminUnbanUserFromTrading($userId: ID!) {
    adminUnbanUserFromTrading(userId: $userId)
  }
`;
