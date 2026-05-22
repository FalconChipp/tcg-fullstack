import { gql } from '@apollo/client';

// ─── Queries ──────────────────────────────────────────────────────────────────

export const SUBSCRIPTION_PLANS = gql`
  query SubscriptionPlans {
    subscriptionPlans {
      id
      name
      description
      price
      currency
      interval
      platformFeePercent
      feeDiscount
      maxBinders
      maxActiveListings
      maxActiveTrades
      featuresJson
      active
      sortOrder
    }
  }
`;

export const MY_SUBSCRIPTION = gql`
  query MySubscription {
    mySubscription {
      id
      status
      cancelAtPeriodEnd
      currentPeriodStart
      currentPeriodEnd
      cancelledAt
      plan {
        id
        name
        price
        currency
        interval
      }
    }
  }
`;

export const MY_CAPABILITIES = gql`
  query MyCapabilities {
    myCapabilities {
      planName
      platformFeePercent
      maxBinders
      maxCollectionCards
      maxActiveListings
      maxActiveTrades
    }
  }
`;

export const SUBSCRIPTION_PORTAL = gql`
  query SubscriptionPortal {
    subscriptionPortal {
      url
    }
  }
`;

export const MY_TRANSACTIONS = gql`
  query MyTransactions($page: Int, $pageSize: Int) {
    myTransactions(page: $page, pageSize: $pageSize) {
      id
      type
      amount
      currency
      status
      description
      createdAt
    }
  }
`;

// ─── Mutations ────────────────────────────────────────────────────────────────

export const CREATE_SUBSCRIPTION = gql`
  mutation CreateSubscription($planId: ID!) {
    createSubscription(planId: $planId) {
      url
      sessionId
    }
  }
`;

export const CANCEL_SUBSCRIPTION = gql`
  mutation CancelSubscription {
    cancelSubscription
  }
`;

export const RESUME_SUBSCRIPTION = gql`
  mutation ResumeSubscription {
    resumeSubscription {
      id
      status
      cancelAtPeriodEnd
      currentPeriodEnd
    }
  }
`;

export const UPDATE_SUBSCRIPTION = gql`
  mutation UpdateSubscription($planId: ID!) {
    updateSubscription(planId: $planId) {
      id
      status
      cancelAtPeriodEnd
      currentPeriodStart
      currentPeriodEnd
      plan {
        id
        name
        price
        currency
        interval
      }
    }
  }
`;
