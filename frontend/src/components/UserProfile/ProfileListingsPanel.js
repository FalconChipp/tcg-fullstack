import React, { useState } from "react";
import { Tag, Edit, Trash2, CheckCircle, XCircle, Coins } from "lucide-react";
import Image from "next/image";
import { getCardImageUrl } from "@/utils/imageUtils"; // CHANGED

// PALETTE-AWARE STATUS COLORS
const STATUS = {
  active: {
    label: "Active",
    color: "bg-light-success/20 text-light-success dark:bg-dark-success/30 dark:text-dark-success",
    icon: <CheckCircle className="w-5 h-5" />,
  },
  pending: {
    label: "Pending",
    color: "bg-light-warning/20 text-light-warning dark:bg-dark-warning/30 dark:text-dark-warning",
    icon: <Tag className="w-5 h-5" />,
  },
  sold: {
    label: "Sold",
    color: "bg-light-primary/20 text-light-primary dark:bg-dark-primary/40 dark:text-dark-primary",
    icon: <Coins className="w-5 h-5" />,
  },
  ended: {
    label: "Ended",
    color: "bg-light-border text-light-textMuted dark:bg-dark-border dark:text-dark-textMuted",
    icon: <XCircle className="w-5 h-5" />,
  },
};

const TYPE_LABELS = {
  sale: "For Sale",
  trade: "For Trade",
};

export default function ProfileListingsPanel({ listings = [], onAction, dark }) {
  const [activeTab, setActiveTab] = useState("active");
  const [editingListing, setEditingListing] = useState(null);

  const filteredListings = listings.filter((l) =>
    activeTab === "active"
      ? l.status === "active"
      : activeTab === "sold"
      ? l.status === "sold"
      : activeTab === "ended"
      ? l.status === "ended"
      : l.status === "pending"
  );

  return (
    <section className="w-full">
      {/* Tabs */}
      <div className="flex gap-3 mb-5">
        {[
          { key: "active", label: "Active" },
          { key: "sold", label: "Sold" },
          { key: "ended", label: "Ended" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`
              px-4 py-1.5 rounded-full font-semibold transition
              ${
                activeTab === tab.key
                  ? "bg-purple-800 text-white"
                  : "bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-purple-950"
              }
            `}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listings grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {filteredListings.length === 0 && (
          <div className="col-span-full text-light-textSecondary dark:text-dark-textSecondary py-12 text-center">
            No {activeTab} listings found.
          </div>
        )}
        {filteredListings.map((listing) => {
          const card = listing.card || {};
          const img = // CHANGED
            card?.images?.large ??
            card?.images?.small ??
            card?.image ??
            card?.tcgImageUrl ??
            "";
          const setLabel = // CHANGED
            card?.set?.name ??
            card?.setName ??
            (card?.setCode ? String(card.setCode).toUpperCase() : "");
          return (
            <div
              key={listing.id}
              className={`
                rounded-xl shadow px-4 py-5 flex flex-col
                bg-light-surface dark:bg-dark-surface
                border border-transparent hover:border-purple-400 transition
                relative
              `}
            >
            {/* Card info */}
            <div className="flex items-center gap-4 mb-2">
                <Image
                  src={getCardImageUrl(img, { cardName: card.name })} // CHANGED
                  alt={card.name}
                  width={60}
                  height={84}
                  className="rounded-lg shadow"
                />
              <div>
                <div className="font-bold text-lg">{card.name}</div>
                <div className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  {setLabel} &nbsp;|&nbsp; #{card.number}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {TYPE_LABELS[listing.type]}
                  </span>
                  <span
                    className={`
                      inline-block ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
                      ${STATUS[listing.status]?.color}
                    `}
                  >
                    {STATUS[listing.status]?.icon} {STATUS[listing.status]?.label}
                  </span>
                </div>
              </div>
            </div>
            {/* Price/Terms */}
            {listing.type === "sale" ? (
              <div className="mt-2 text-lg font-bold text-light-success dark:text-dark-success flex items-center gap-1">
                £{Number(listing.price).toFixed(2)} <Coins className="w-4 h-4 inline" />
              </div>
            ) : (
              <div className="mt-2 text-sm font-medium text-light-primary dark:text-dark-primary">
                <span className="mr-1">Trade for:</span>
                {listing.tradeTerms}
              </div>
            )}
            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                className="flex items-center gap-1 px-3 py-1 rounded bg-purple-700 text-white hover:bg-purple-500 transition text-sm font-semibold"
                onClick={() => setEditingListing(listing)}
                aria-label="Edit listing"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
              <button
                className="
                  flex items-center gap-1 px-3 py-1 rounded
                  bg-light-alt dark:bg-dark-alt
                  text-light-text dark:text-dark-text
                  hover:bg-light-error/20 dark:hover:bg-dark-error/40
                  transition text-sm font-semibold
                "
                onClick={() => onAction("remove", listing)}
                aria-label="Remove listing"
              >
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            </div>
            {/* Overlay for non-active listings */}
            {listing.status !== "active" && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-light-surface/80 dark:bg-dark-surface/90 z-10 rounded-xl">
                <span className={`text-xl font-bold ${STATUS[listing.status]?.color}`}>
                  {STATUS[listing.status]?.label}
                </span>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingListing && (
        <EditListingModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSave={(updated) => {
            setEditingListing(null);
            onAction("edit", updated);
          }}
        />
      )}
    </section>
  );
}

// Edit modal for listings (palette-aware version)
function EditListingModal({ listing, onClose, onSave }) {
  const [price, setPrice] = useState(listing.price || "");
  const [tradeTerms, setTradeTerms] = useState(listing.tradeTerms || "");
  const [status, setStatus] = useState(listing.status);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...listing, price, tradeTerms, status });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="relative bg-light-surface dark:bg-dark-surface rounded-xl max-w-md w-full p-6 shadow-xl">
        <button
          className="absolute top-4 right-4 p-1 bg-light-alt dark:bg-dark-alt rounded-full hover:bg-light-border dark:hover:bg-dark-border transition"
          onClick={onClose}
        >
          <XCircle className="w-5 h-5 text-light-textSecondary dark:text-dark-textSecondary" />
        </button>
        <h2 className="text-xl font-bold mb-4">Edit Listing</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {listing.type === "sale" && (
            <div>
              <label className="block text-sm font-medium mb-1">Price (£)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
              />
            </div>
          )}
          {listing.type === "trade" && (
            <div>
              <label className="block text-sm font-medium mb-1">Trade For</label>
              <input
                type="text"
                value={tradeTerms}
                onChange={e => setTradeTerms(e.target.value)}
                className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              type="submit"
              className="px-4 py-2 bg-purple-700 text-white rounded font-semibold hover:bg-purple-600 transition w-full"
            >
              Save Changes
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text rounded font-semibold hover:bg-light-border dark:hover:bg-dark-border transition w-full"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
