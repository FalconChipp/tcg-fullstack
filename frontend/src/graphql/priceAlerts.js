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
        currency
        createdAt
        updatedAt
      }
    }
  `,
};

/* =========================== MUTATIONS ============================ */

export const ALERT_MUTATIONS = {
  UPSERT: /* GraphQL */ `
    mutation UpsertPriceAlert($input: UpsertPriceAlertInput!) {
      upsertPriceAlert(input: $input) {
        id
      }
    }
  `,
  DELETE: /* GraphQL */ `
    mutation DeletePriceAlert($id: ID!) {
      deletePriceAlert(id: $id)
    }
  `,
  TOGGLE: /* GraphQL */ `
    mutation TogglePriceAlert($id: ID!, $active: Boolean!) {
      togglePriceAlert(id: $id, active: $active)
    }
  `,
};

/* ============================= HELPERS ============================ */

export async function fetchMyAlerts({ token, cardId, variation } = {}) {
  const data = await executeQuery(ALERT_QUERIES.LIST, {}, token);
  let list = data?.myPriceAlerts || [];
  if (cardId) {
    list = list.filter((row) => row.cardId === cardId);
  }
  if (variation !== undefined) {
    const target = variation == null ? null : String(variation).toLowerCase();
    list = list.filter((row) => {
      const current = row.variation == null ? null : String(row.variation).toLowerCase();
      return current === target;
    });
  }
  return list;
}

export async function upsertAlert({ token, input }) {
  const data = await executeQuery(ALERT_MUTATIONS.UPSERT, { input }, token);
  return data?.upsertPriceAlert?.id || null;
}

export async function deleteAlert({ token, id }) {
  const data = await executeQuery(ALERT_MUTATIONS.DELETE, { id }, token);
  return data?.deletePriceAlert === true;
}

export async function toggleAlert({ token, id, isActive }) {
  const data = await executeQuery(ALERT_MUTATIONS.TOGGLE, { id, active: isActive }, token);
  return data?.togglePriceAlert === true;
}
