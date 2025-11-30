// frontend/src/components/Admin/AdminOrdersPanel.js
// -----------------------------------------------------------------------------
// Admin panel: list marketplace orders with fulfilment + payment status,
// basic buyer/seller info, shipping address, POD status, and the ability to
// advance the fulfilment pipeline.
// -----------------------------------------------------------------------------
//
// Uses:
//  - adminOrders(limit, offset) query
//  - adminUpdateOrderFulfilmentStatus(orderId, status) mutation
//
// Fulfilment pipeline (backend enums):
//  - pending -> processing -> in_printing -> shipped -> completed / cancelled
//
// This panel currently:
//  - Fetches up to 100 orders (newest first).
//  - Shows order number, created date, buyer, seller, listing summary,
//    shipping address, POD status, total, paymentStatus, fulfilmentStatus.
//  - Allows admin to change fulfilmentStatus via a <select> control.
// -----------------------------------------------------------------------------

"use client";

import React, { useMemo, useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";

// ---------------- GraphQL: admin orders + fulfilment mutation ---------------

const ADMIN_ORDERS_QUERY = gql`
  query AdminOrders($limit: Int, $offset: Int) {
    adminOrders(limit: $limit, offset: $offset) {
      id
      orderNumber
      createdAt
      status
      fulfilmentStatus
      paymentStatus
      total
      currency
      buyerEmail
      buyerName
      shippingAddressJson
      metadataJson

      buyer {
        id
        username
        email
      }
      seller {
        id
        username
        email
      }

      listing {
        __typename
        id
        type
        ... on ProductListing {
          title
          fulfilmentType
        }
        ... on CardListing {
          cardId
          condition
          variation
        }
      }
    }
  }
`;

const ADMIN_UPDATE_ORDER_FULFILMENT_STATUS = gql`
  mutation AdminUpdateOrderFulfilmentStatus(
    $orderId: ID!
    $status: OrderFulfilmentStatus!
  ) {
    adminUpdateOrderFulfilmentStatus(orderId: $orderId, status: $status) {
      id
      status
      fulfilmentStatus
      shippedAt
      completedAt
    }
  }
`;

// ---------------- Helpers: formatting & badges -------------------------------

const FULFILMENT_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "in_printing", label: "In printing" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function titleCaseEnum(value) {
  if (!value) return "—";
  const normalized = String(value).replace(/_/g, " ");
  return normalized
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function StatusBadge({ kind, value }) {
  if (!value) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-neutral-700/40 text-neutral-200">
        —
      </span>
    );
  }

  const v = String(value).toLowerCase();

  let base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ";
  let cls = "bg-neutral-700/40 text-neutral-100 border border-white/5";

  if (kind === "payment") {
    if (v === "paid") {
      cls = "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40";
    } else if (v === "pending") {
      cls = "bg-amber-500/10 text-amber-200 border border-amber-500/40";
    } else if (v === "refunded") {
      cls = "bg-sky-500/10 text-sky-200 border border-sky-500/40";
    } else if (v === "failed" || v === "cancelled") {
      cls = "bg-red-500/10 text-red-200 border border-red-500/40";
    }
  }

  if (kind === "fulfilment") {
    if (v === "pending" || v === "processing") {
      cls = "bg-amber-500/10 text-amber-200 border border-amber-500/40";
    } else if (v === "in_printing") {
      cls = "bg-indigo-500/10 text-indigo-200 border border-indigo-500/40";
    } else if (v === "shipped") {
      cls = "bg-sky-500/10 text-sky-200 border border-sky-500/40";
    } else if (v === "completed") {
      cls = "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40";
    } else if (v === "cancelled") {
      cls = "bg-red-500/10 text-red-200 border border-red-500/40";
    }
  }

  return <span className={base + cls}>{titleCaseEnum(value)}</span>;
}

function ListingSummary({ listing }) {
  if (!listing) {
    return (
      <span className="text-[11px] text-neutral-500">Listing not found</span>
    );
  }

  const type = String(listing.type || listing.__typename || "").toUpperCase();

  if (type === "PRODUCT") {
    const title = listing.title || "Product";
    return (
      <div className="space-y-0.5">
        <p className="text-[11px] text-neutral-100 font-medium">{title}</p>
        <p className="text-[10px] text-neutral-500">
          {listing.fulfilmentType
            ? `Product • ${listing.fulfilmentType.toUpperCase()}`
            : "Product listing"}
        </p>
      </div>
    );
  }

  if (type === "CARD") {
    return (
      <div className="space-y-0.5">
        <p className="text-[11px] text-neutral-100 font-medium">
          Card listing
        </p>
        <p className="text-[10px] text-neutral-500">
          {listing.cardId || "Card"}{" "}
          {listing.variation ? `• ${listing.variation}` : ""}{" "}
          {listing.condition ? `• ${listing.condition}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-neutral-100 font-medium">
        {listing.__typename || "Listing"}
      </p>
      <p className="text-[10px] text-neutral-500">ID: {listing.id}</p>
    </div>
  );
}

function UserCell({ user, fallbackEmail, label }) {
  if (!user && !fallbackEmail) {
    return (
      <span className="text-[11px] text-neutral-500">
        {label === "buyer" ? "Guest (no account)" : "—"}
      </span>
    );
  }

  const name =
    user?.username ||
    (label === "buyer" ? fallbackEmail : null) ||
    (label === "seller" ? "Seller" : "User");

  const email = user?.email || fallbackEmail || null;

  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-neutral-100 font-medium">{name}</span>
      {email && (
        <span className="text-[10px] text-neutral-500">{email}</span>
      )}
      {user?.id && (
        <span className="text-[10px] text-neutral-600">{user.id}</span>
      )}
    </div>
  );
}

/**
 * Shipping address cell – handles structured ShippingAddressInput-like JSON.
 * Safely deals with both objects and accidental stringified JSON.
 */
function ShippingAddressCell({ address }) {
  if (!address) {
    return (
      <span className="text-[11px] text-neutral-500">
        No shipping address
      </span>
    );
  }

  let addr = address;

  // Just in case shippingAddressJson is stored as a string somewhere
  if (typeof addr === "string") {
    try {
      addr = JSON.parse(addr);
    } catch {
      return (
        <span className="text-[11px] text-neutral-500">
          Invalid address format
        </span>
      );
    }
  }

  if (!addr || typeof addr !== "object") {
    return (
      <span className="text-[11px] text-neutral-500">
        Invalid address format
      </span>
    );
  }

  const {
    line1,
    line2,
    city,
    region,
    postalCode,
    postcode,
    country,
    address1,
    address2,
  } = addr;

  const line1Text = line1 || address1 || "";
  const line2Text = line2 || address2 || "";
  const townLine = [city, region].filter(Boolean).join(", ");
  const postCodeText = postalCode || postcode || "";
  const postCountry = [postCodeText, country].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col space-y-0.5">
      {line1Text && (
        <span className="text-[11px] text-neutral-100">{line1Text}</span>
      )}
      {line2Text && (
        <span className="text-[10px] text-neutral-400">{line2Text}</span>
      )}
      {townLine && (
        <span className="text-[10px] text-neutral-400">{townLine}</span>
      )}
      {postCountry && (
        <span className="text-[10px] text-neutral-400">{postCountry}</span>
      )}

      {!line1Text && !townLine && !postCountry && (
        <span className="text-[11px] text-neutral-500">
          Address incomplete
        </span>
      )}
    </div>
  );
}

/**
 * POD / Inkthreadables status cell
 * Reads order.metadataJson.pod (handling stringified JSON safely).
 */
function PodStatusCell({ metadataJson }) {
  if (!metadataJson) {
    return (
      <span className="text-[11px] text-neutral-500">
        No POD metadata
      </span>
    );
  }

  let meta = metadataJson;

  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return (
        <span className="text-[11px] text-neutral-500">
          Invalid metadata
        </span>
      );
    }
  }

  if (!meta || typeof meta !== "object") {
    return (
      <span className="text-[11px] text-neutral-500">
        Invalid metadata
      </span>
    );
  }

  const pod = meta.pod || {};
  const provider = pod.provider || "POD";
  const status = pod.inkStatus || "—";
  const orderId = pod.inkOrderId || null;
  const lastError = pod.lastError || null;
  const lastErrorAt = pod.lastErrorAt || null;

  const hasError = !!lastError;

  const badgeBase =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ";
  const badgeCls = hasError
    ? "bg-red-500/10 text-red-200 border border-red-500/40"
    : "bg-indigo-500/10 text-indigo-200 border border-indigo-500/40";

  return (
    <div className="flex flex-col space-y-0.5">
      <span className={badgeBase + badgeCls}>
        {provider} • {titleCaseEnum(status)}
      </span>
      {orderId && (
        <span className="text-[10px] text-neutral-400">
          Ink order: {orderId}
        </span>
      )}
      {hasError && (
        <span className="text-[10px] text-red-300">
          Error: {lastError}
          {lastErrorAt && (
            <>
              <br />
              <span className="text-[9px] text-red-200/80">
                At: {new Date(lastErrorAt).toLocaleString()}
              </span>
            </>
          )}
        </span>
      )}
      {!orderId && !hasError && (
        <span className="text-[10px] text-neutral-500">
          POD submitted (awaiting ID/status)
        </span>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function AdminOrdersPanel() {
  const [limit] = useState(100);

  const { data, loading, error, refetch } = useQuery(ADMIN_ORDERS_QUERY, {
    variables: { limit, offset: 0 },
    fetchPolicy: "cache-first",
  });

  const [updateFulfilment, { loading: updating }] = useMutation(
    ADMIN_UPDATE_ORDER_FULFILMENT_STATUS
  );

  const orders = data?.adminOrders ?? [];

  const handleChangeFulfilment = async (orderId, newStatus) => {
    if (!newStatus) return;

    try {
      await updateFulfilment({
        variables: {
          orderId,
          status: newStatus,
        },
      });
      await refetch();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[AdminOrdersPanel] Failed to update fulfilment:", err);
      // In future you could show a toast here.
    }
  };

  const totalCount = useMemo(() => orders.length, [orders]);

  if (loading) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300 mb-2">Loading orders…</p>
        <p className="text-xs text-neutral-500">
          Fetching the most recent orders from the marketplace.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/40 rounded-xl p-4 bg-red-950/40">
        <p className="text-sm text-red-300 font-semibold mb-1">
          Failed to load orders
        </p>
        <p className="text-xs text-red-200 mb-3">{error.message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-red-400/60 text-red-50 hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="border border-white/5 rounded-xl p-4 bg-black/40">
        <p className="text-sm text-neutral-300">No orders found yet.</p>
        <p className="text-xs text-neutral-500 mt-1">
          Orders will appear here once buyers start checking out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">Orders</h2>
          <p className="text-xs text-neutral-500">
            Showing {totalCount} recent orders (limit {limit}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updating && (
            <span className="text-[11px] text-neutral-400">
              Updating fulfilment…
            </span>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border border-white/20 text-neutral-50 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-white/5 rounded-xl bg-black/40">
        <table className="min-w-full text-xs">
          <thead className="bg-white/5 text-neutral-300">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Order</th>
              <th className="px-3 py-2 text-left font-semibold">Buyer</th>
              <th className="px-3 py-2 text-left font-semibold">Seller</th>
              <th className="px-3 py-2 text-left font-semibold">Listing</th>
              <th className="px-3 py-2 text-left font-semibold">Shipping</th>
              <th className="px-3 py-2 text-left font-semibold">POD</th>
              <th className="px-3 py-2 text-left font-semibold">Total</th>
              <th className="px-3 py-2 text-left font-semibold">Payment</th>
              <th className="px-3 py-2 text-left font-semibold">
                Fulfilment
              </th>
              <th className="px-3 py-2 text-left font-semibold">Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const listing = order.listing;

              return (
                <tr
                  key={order.id}
                  className="border-t border-white/5 hover:bg-white/5 transition"
                >
                  {/* Order basic info */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold text-neutral-50">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        ID: {order.id}
                      </span>
                    </div>
                  </td>

                  {/* Buyer */}
                  <td className="px-3 py-2 align-top">
                    <UserCell
                      user={order.buyer}
                      fallbackEmail={order.buyerEmail}
                      label="buyer"
                    />
                  </td>

                  {/* Seller */}
                  <td className="px-3 py-2 align-top">
                    <UserCell user={order.seller} label="seller" />
                  </td>

                  {/* Listing */}
                  <td className="px-3 py-2 align-top">
                    <ListingSummary listing={listing} />
                  </td>

                  {/* Shipping address */}
                  <td className="px-3 py-2 align-top">
                    <ShippingAddressCell
                      address={order.shippingAddressJson}
                    />
                  </td>

                  {/* POD status */}
                  <td className="px-3 py-2 align-top">
                    <PodStatusCell metadataJson={order.metadataJson} />
                  </td>

                  {/* Total */}
                  <td className="px-3 py-2 align-top">
                    <span className="text-[11px] text-neutral-100 font-medium">
                      {order.total} {order.currency || "GBP"}
                    </span>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      Legacy status: {titleCaseEnum(order.status)}
                    </div>
                  </td>

                  {/* Payment status */}
                  <td className="px-3 py-2 align-top">
                    <StatusBadge kind="payment" value={order.paymentStatus} />
                  </td>

                  {/* Fulfilment status */}
                  <td className="px-3 py-2 align-top">
                    <StatusBadge
                      kind="fulfilment"
                      value={order.fulfilmentStatus}
                    />
                  </td>

                  {/* Fulfilment update control */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-neutral-500">
                        Change status
                      </label>
                      <select
                        className="bg-black/60 border border-white/15 rounded-md px-2 py-1 text-[11px] text-neutral-100 focus:outline-none focus:ring-1 focus:ring-white/40"
                        value={order.fulfilmentStatus || "pending"}
                        disabled={updating}
                        onChange={(e) =>
                          handleChangeFulfilment(order.id, e.target.value)
                        }
                      >
                        {FULFILMENT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
