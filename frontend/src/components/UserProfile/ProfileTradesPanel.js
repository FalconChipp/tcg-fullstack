import React, { useState } from "react";
import {
  User,
  Package,
  CheckCircle,
  XCircle,
  Loader,
  Mail,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import { getCardImageUrl } from "@/utils/imageUtils"; // CHANGED

// Statuses with palette classes (adjust if you add more palette entries)
const TRADE_STATUS = {
  pending: {
    color:
      "bg-vault-warning/30 text-vault-warning dark:bg-vault-warning/30 dark:text-vault-warning",
    label: "Pending",
    icon: <Loader className="w-5 h-5 animate-spin" />,
  },
  shipped: {
    color:
      "bg-vault-accent/20 text-vault-accent dark:bg-vault-accent/30 dark:text-vault-accent",
    label: "Shipped",
    icon: <Package className="w-5 h-5" />,
  },
  completed: {
    color:
      "bg-vault-success/20 text-vault-success dark:bg-vault-success/40 dark:text-vault-success",
    label: "Completed",
    icon: <CheckCircle className="w-5 h-5" />,
  },
  cancelled: {
    color:
      "bg-vault-danger/20 text-vault-danger dark:bg-vault-danger/40 dark:text-vault-danger",
    label: "Cancelled",
    icon: <XCircle className="w-5 h-5" />,
  },
};

export default function ProfileTradesPanel({ trades = [], onAction, dark }) {
  const [activeFilter, setActiveFilter] = useState("active");
  const [selectedTrade, setSelectedTrade] = useState(null);

  const filteredTrades = trades.filter((trade) => {
    if (activeFilter === "active")
      return ["pending", "shipped"].includes(trade.status);
    if (activeFilter === "completed") return trade.status === "completed";
    if (activeFilter === "cancelled") return trade.status === "cancelled";
    return true;
  });

  return (
    <section className="w-full">
      {/* Filters */}
      <div className="flex gap-3 mb-5">
        {["active", "completed", "cancelled"].map((f) => (
          <button
            key={f}
            className={`
              px-4 py-1.5 rounded-[6px] font-semibold transition
              ${
                activeFilter === f
                  ? "bg-purple-800 text-white"
                  : "bg-vault-raised text-vault-text hover:bg-vault-border dark:hover:bg-purple-950"
              }
            `}
            onClick={() => setActiveFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {/* Trade list */}
      <div className="flex flex-col gap-4">
        {filteredTrades.length === 0 && (
          <div className="text-vault-textSecondary py-12 text-center">
            No {activeFilter} trades to show.
          </div>
        )}
        {filteredTrades.map((trade) => (
          <div
            key={trade.id}
            className={`
              rounded-[10px]  px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 
              bg-vault-surface border border-transparent hover:border-purple-400 transition
              cursor-pointer
            `}
            onClick={() => setSelectedTrade(trade)}
            tabIndex={0}
            aria-label={`View details for trade with ${trade.otherUser?.name || "user"}`}
          >
            {/* User */}
            <div className="flex items-center gap-3 w-full sm:w-56">
              <Image
                src={
                  trade.otherUser?.avatar || "/assets/avatar-placeholder.png"
                }
                alt={trade.otherUser?.name || "User"}
                width={38}
                height={38}
                className="rounded-[6px] border border-vault-border object-cover"
              />
              <span className="font-semibold text-base">
                {trade.otherUser?.name || "User"}
              </span>
            </div>
            {/* Arrow */}
            <ArrowRight className="hidden sm:block w-6 h-6 text-vault-border dark:text-vault-border mx-2" />
            {/* Cards */}
            <div className="flex-1 flex flex-wrap gap-2">
              {/* You give */}
              <div className="flex items-center gap-1">
                {trade.cardsSent.slice(0, 2).map((card) => {
                  const img =
                    card?.images?.large ??
                    card?.images?.small ??
                    card?.image ??
                    card?.tcgImageUrl ??
                    ""; // CHANGED
                  return (
                    <Image
                      key={card.name}
                      src={getCardImageUrl(img, { cardName: card.name })}
                      alt={card.name}
                      width={28}
                      height={38}
                      className="rounded "
                    />
                  );
                })}
                {trade.cardsSent.length > 2 && (
                  <span className="text-xs text-vault-textSecondary ml-2">
                    +{trade.cardsSent.length - 2} more
                  </span>
                )}
                <span className="ml-2 text-xs text-vault-textSecondary">
                  sent
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-400 mx-2 sm:hidden" />
              {/* You receive */}
              <div className="flex items-center gap-1">
                {trade.cardsReceived.slice(0, 2).map((card) => {
                  const img =
                    card?.images?.large ??
                    card?.images?.small ??
                    card?.image ??
                    card?.tcgImageUrl ??
                    ""; // CHANGED
                  return (
                    <Image
                      key={card.name}
                      src={getCardImageUrl(img, { cardName: card.name })}
                      alt={card.name}
                      width={28}
                      height={38}
                      className="rounded "
                    />
                  );
                })}
                {trade.cardsReceived.length > 2 && (
                  <span className="text-xs text-vault-textSecondary ml-2">
                    +{trade.cardsReceived.length - 2} more
                  </span>
                )}
                <span className="ml-2 text-xs text-vault-textSecondary">
                  received
                </span>
              </div>
            </div>
            {/* Status */}
            <div className="flex items-center gap-2 min-w-[110px]">
              <span
                className={`px-3 py-1 rounded-[6px] text-xs font-semibold flex items-center gap-1 ${TRADE_STATUS[trade.status]?.color}`}
              >
                {TRADE_STATUS[trade.status]?.icon}
                {TRADE_STATUS[trade.status]?.label || trade.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Trade Details */}
      {selectedTrade && (
        <TradeDetailsModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onAction={onAction}
          dark={dark}
        />
      )}
    </section>
  );
}

/* TradeDetailsModal with palette */
function TradeDetailsModal({ trade, onClose, onAction, dark }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="relative bg-vault-surface rounded-[10px] max-w-2xl w-full p-6 ">
        <button
          className="absolute top-4 right-4 p-1 bg-vault-raised rounded-[6px] hover:bg-vault-border dark:hover:bg-vault-border transition"
          onClick={onClose}
        >
          <XCircle className="w-5 h-5 text-vault-textSecondary" />
        </button>
        <div className="flex items-center gap-4 mb-6">
          <Image
            src={trade.otherUser?.avatar || "/assets/avatar-placeholder.png"}
            alt={trade.otherUser?.name || "User"}
            width={44}
            height={44}
            className="rounded-[6px] border border-vault-border"
          />
          <span className="text-lg font-bold">
            {trade.otherUser?.name || "User"}
          </span>
          <span
            className={`ml-auto px-3 py-1 rounded-[6px] text-xs font-semibold flex items-center gap-1 ${TRADE_STATUS[trade.status]?.color}`}
          >
            {TRADE_STATUS[trade.status]?.icon}
            {TRADE_STATUS[trade.status]?.label || trade.status}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="font-semibold mb-2">You Sent</h3>
            <div className="flex flex-wrap gap-2">
              {trade.cardsSent.map((card) => (
                <div key={card.name} className="flex flex-col items-center">
                  <Image
                    src={card.image}
                    alt={card.name}
                    width={42}
                    height={58}
                    className="rounded "
                  />
                  <span className="text-xs mt-1">
                    {card.name} x{card.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">You Received</h3>
            <div className="flex flex-wrap gap-2">
              {trade.cardsReceived.map((card) => (
                <div key={card.name} className="flex flex-col items-center">
                  <Image
                    src={card.image}
                    alt={card.name}
                    width={42}
                    height={58}
                    className="rounded "
                  />
                  <span className="text-xs mt-1">
                    {card.name} x{card.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Status and actions */}
        <div className="flex gap-3 items-center">
          {trade.status === "pending" && (
            <>
              <button
                className="bg-purple-800 text-white px-4 py-2 rounded-[6px] font-semibold hover:bg-purple-700 transition"
                onClick={() => onAction("accept", trade)}
              >
                Accept Trade
              </button>
              <button
                className="bg-vault-danger text-white px-4 py-2 rounded-[6px] font-semibold hover:bg-vault-danger/80 dark:bg-vault-danger dark:hover:bg-vault-danger/90 transition"
                onClick={() => onAction("cancel", trade)}
              >
                Cancel
              </button>
            </>
          )}
          {trade.status === "shipped" && (
            <a
              href={`https://track.royalmail.com/track-your-item#/tracking-results/${trade.trackingNumber}`}
              className="text-vault-accent dark:text-vault-accent hover:underline font-semibold flex items-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Package className="w-5 h-5" />
              Track Package
            </a>
          )}
          {trade.status === "completed" && (
            <span className="text-vault-success dark:text-vault-success font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Trade Complete
            </span>
          )}
          {trade.status === "cancelled" && (
            <span className="text-vault-danger dark:text-vault-danger font-semibold flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Cancelled
            </span>
          )}
          <button
            className="ml-auto flex items-center gap-1 text-vault-accent dark:text-vault-accent font-semibold hover:underline"
            onClick={() => onAction("message", trade)}
          >
            <Mail className="w-5 h-5" /> Message User
          </button>
        </div>
      </div>
    </div>
  );
}
