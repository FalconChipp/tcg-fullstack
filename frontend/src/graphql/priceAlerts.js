// src/graphql/priceAlerts.js
// Typed documents from the shared api-client package.
// Helper functions are preserved for non-Apollo (raw fetch) usage via executeQuery.

import { print } from 'graphql';
import {
  MyPriceAlertsDocument,
  UpsertPriceAlertDocument,
  DeletePriceAlertDocument,
  TogglePriceAlertDocument,
} from '@sixbyfive/api-client';
import { executeQuery } from '@/utils/graphqlUtils';

// ── Typed documents (use with Apollo useQuery / useMutation) ──────────────────

export {
  MyPriceAlertsDocument,
  UpsertPriceAlertDocument,
  DeletePriceAlertDocument,
  TogglePriceAlertDocument,
};

// ── Raw-fetch helpers (kept for backwards compatibility) ──────────────────────

export async function fetchMyAlerts({ token, cardId, variation } = {}) {
  const data = await executeQuery(print(MyPriceAlertsDocument), {}, token);
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
  const data = await executeQuery(print(UpsertPriceAlertDocument), { input }, token);
  return data?.upsertPriceAlert?.id || null;
}

export async function deleteAlert({ token, id }) {
  const data = await executeQuery(print(DeletePriceAlertDocument), { id }, token);
  return data?.deletePriceAlert === true;
}

export async function toggleAlert({ token, id, isActive }) {
  const data = await executeQuery(print(TogglePriceAlertDocument), { id, active: isActive }, token);
  return data?.togglePriceAlert === true;
}
