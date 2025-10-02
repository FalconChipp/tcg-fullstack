// src/graphql/priceAlerts.js
// NEW: GraphQL ops + helpers for managing price alerts

import { executeQuery } from '@/utils/graphqlUtils';

/* ============================= QUERIES ============================= */

export const ALERT_QUERIES = {
  LIST: /* GraphQL */ `
    query MyPriceAlerts {
      myPriceAlerts {
        id
        cardId
        variation
        condition
        value
        windowHours
        cooldownHours
        isActive
        lastFiredAt
        createdAt
      }
    }
  `,
};

/* =========================== MUTATIONS ============================ */

export const ALERT_MUTATIONS = {
  UPSERT: /* GraphQL */ `
    mutation UpsertPriceAlert(
      $id: ID
      $cardId: ID!
      $variation: String
      $condition: String!
      $value: Float!
      $windowHours: Int!
      $cooldownHours: Int
      $isActive: Boolean
    ) {
      upsertPriceAlert(
        id: $id
        cardId: $cardId
        variation: $variation
        condition: $condition
        value: $value
        windowHours: $windowHours
        cooldownHours: $cooldownHours
        isActive: $isActive
      ) { id }
    }
  `,
  DELETE: /* GraphQL */ `
    mutation DeletePriceAlert($id: ID!) {
      deletePriceAlert(id: $id)
    }
  `,
  TOGGLE: /* GraphQL */ `
    mutation TogglePriceAlert($id: ID!, $isActive: Boolean!) {
      togglePriceAlert(id: $id, isActive: $isActive)
    }
  `,
};

/* ============================= HELPERS ============================ */

export async function fetchMyAlerts({ token }) {
  const data = await executeQuery(ALERT_QUERIES.LIST, {}, token);
  return data?.myPriceAlerts || [];
}

export async function upsertAlert({ token, input }) {
  const data = await executeQuery(ALERT_MUTATIONS.UPSERT, input, token);
  return data?.upsertPriceAlert?.id || null;
}

export async function deleteAlert({ token, id }) {
  const data = await executeQuery(ALERT_MUTATIONS.DELETE, { id }, token);
  return data?.deletePriceAlert === true;
}

export async function toggleAlert({ token, id, isActive }) {
  const data = await executeQuery(ALERT_MUTATIONS.TOGGLE, { id, isActive }, token);
  return data?.togglePriceAlert === true;
}
