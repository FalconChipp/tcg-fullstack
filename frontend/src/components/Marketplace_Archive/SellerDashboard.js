"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Edit2, Trash2, CheckCircle, XCircle, Coins, Plus, BarChart, HelpCircle } from "lucide-react";
import { getCardImageUrl } from "@/utils/imageUtils"; // CHANGED

// ---- DUMMY DATA ----
const mockSellerListings = [
  // Add as many as you want for testing!
  {
    id: "1",
    type: "sale",
    status: "active",
    price: 49.99,
    card: {
      name: "Charizard GX",
      image: "/cards/charizard-gx.png",
      setName: "Hidden Fates",
      number: "SV49",
    },
  },
  {
    id: "2",
    type: "sale",
    status: "sold",
    price: 12.5,
    card: {
      name: "Gardevoir ex",
      image: "/cards/gardevoir-ex.png",
      setName: "Scarlet & Violet",
      number: "245/198",
    },
  },
  {
    id: "3",
    type: "trade",
    status: "ended",
    tradeTerms: "Trade for Mewtwo EX",
    card: {
      name: "Sylveon V",
      image: "/cards/sylveon-v.png",
      setName: "Evolving Skies",
      number: "184/203",
    },
  },
];

// ---- STATUS LABELS & COLORS ----
const STATUS = {
  active: {
    label: "Active",
    color: "bg-light-success/20 text-light-success dark:bg-dark-success/30 dark:text-dark-success",
    icon: <CheckCircle className="w-5 h-5 mr-1" />,
  },
  sold: {
    label: "Sold",
    color: "bg-light-primary/20 text-light-primary dark:bg-dark-primary/40 dark:text-dark-primary",
    icon: <Coins className="w-5 h-5 mr-1" />,
  },
  ended: {
    label: "Ended",
    color: "bg-light-border text-light-textMuted dark:bg-dark-border dark:text-dark-textMuted",
    icon: <XCircle className="w-5 h-5 mr-1" />,
  },
};

const TABS = [
  { key: "active", label: "Active" },
  { key: "sold", label: "Sold" },
  { key: "ended", label: "Ended" },
  { key: "orders", label: "Orders/Offers" },
];

// ---- DUMMY ORDER/OFFER DATA ----
const mockOrders = [
  {
    id: "o1",
    card: {
      name: "Charizard GX",
      image: "/cards/charizard-gx.png",
    },
    buyer: "AshKetchum",
    status: "pending", // pending, paid, shipped
    offer: 47.99,
    date: "2025-07-25T10:22:00Z",
  },
  {
    id: "o2",
    card: {
      name: "Gardevoir ex",
      image: "/cards/gardevoir-ex.png",
    },
    buyer: "Misty",
    status: "paid",
    offer: 12.00,
    date: "2025-07-24T13:14:00Z",
  },
];

// ---- DASHBOARD MAIN ----
export default function SellerDashboard() {
  // ---- STATE ----
  const [tab, setTab] = useState("active");
  const [listings, setListings] = useState(mockSellerListings);
  const [editModal, setEditModal] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrders] = useState(mockOrders); // Static for demo
  const [banner, setBanner] = useState("You have 1 unshipped order.");

  // ---- HANDLERS ----
  function handleEdit(listing) {
    setEditModal(listing);
  }
  function handleRemove(id) {
    setListings(listings => listings.filter(l => l.id !== id));
  }
  function handleSave(edited) {
    setListings(listings => listings.map(l => (l.id === edited.id ? edited : l)));
    setEditModal(null);
  }
  function handleAdd(newListing) {
    setListings(listings => [...listings, { ...newListing, id: Date.now().toString() }]);
    setShowAddModal(false);
  }
  // ---- DERIVED STATS ----
  const sold = listings.filter(l => l.status === "sold");
  const earnings = sold.reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const filtered = listings.filter(l => l.status === tab);

  // ---- PAGINATION (mock) ----
  const [page, setPage] = useState(1);
  const perPage = 6;
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const pageCount = Math.ceil(filtered.length / perPage);

  return (
    <section className="max-w-5xl mx-auto py-12 px-4">
      {/* ---- (1) STATS BAR ---- */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-light-alt dark:bg-dark-alt p-4 rounded-xl shadow font-bold">
          <div className="text-2xl text-light-primary dark:text-dark-primary">{listings.length}</div>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Total Listings</div>
        </div>
        <div className="bg-light-alt dark:bg-dark-alt p-4 rounded-xl shadow font-bold">
          <div className="text-2xl text-light-primary dark:text-dark-primary">{sold.length}</div>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Sold</div>
        </div>
        <div className="bg-light-alt dark:bg-dark-alt p-4 rounded-xl shadow font-bold">
          <div className="text-2xl text-light-success dark:text-dark-success">£{earnings.toFixed(2)}</div>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Earnings</div>
        </div>
        <div className="bg-light-alt dark:bg-dark-alt p-4 rounded-xl shadow font-bold">
          <div className="text-2xl text-light-accent dark:text-dark-accent">★ 5.0</div>
          <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Seller Rating</div>
        </div>
      </div>

      {/* ---- (9) NOTIFICATION BANNER ---- */}
      {banner && (
        <div className="mb-7 rounded-xl bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-200 px-5 py-3 shadow flex items-center gap-3">
          <HelpCircle className="w-6 h-6" />
          <div className="flex-1">{banner}</div>
          <button
            className="font-bold text-yellow-800 dark:text-yellow-100 px-2"
            onClick={() => setBanner(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* ---- (5) QUICK LISTING BUTTON ---- */}
      <div className="flex justify-end mb-6">
        <button
          className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold shadow bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface hover:bg-light-accentLight dark:hover:bg-dark-accentLight border-2 border-light-accent dark:border-dark-accent transition"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-5 h-5" /> Add New Listing
        </button>
      </div>

      {/* ---- (2) TABS ---- */}
      <div className="flex gap-3 justify-center mb-8">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`px-5 py-2 rounded-full font-bold transition border
              ${tab === t.key
                ? "bg-light-accent dark:bg-dark-accent text-white border-light-accent dark:border-dark-accent shadow"
                : "bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text border-light-border dark:border-dark-border hover:bg-light-border dark:hover:bg-dark-border"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- (7) ORDERS / OFFERS ---- */}
      {tab === "orders" && (
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4">Recent Orders & Offers</h2>
          <div className="bg-light-alt dark:bg-dark-alt rounded-xl p-5 shadow">
            {selectedOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between border-b border-light-border dark:border-dark-border py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <Image src={o.card.image} alt={o.card.name} width={40} height={55} className="rounded" />
                  <div>
                    <div className="font-bold">{o.card.name}</div>
                    <div className="text-xs text-light-textMuted dark:text-dark-textMuted">{o.buyer}</div>
                  </div>
                </div>
                <div className="text-base font-bold text-light-accent dark:text-dark-accent">£{o.offer.toFixed(2)}</div>
                <div className="text-xs">{new Date(o.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
                <div className="font-semibold capitalize">{o.status}</div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-light-success/80 text-white rounded">Accept</button>
                  <button className="px-3 py-1 bg-light-error/80 text-white rounded">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- (8) SELLER HELP SECTION ---- */}
      <div className="mb-10">
        <h3 className="text-lg font-bold mb-2 text-light-primary dark:text-dark-primary">Seller Help & Resources</h3>
        <div className="bg-light-alt dark:bg-dark-alt rounded-xl p-4 shadow text-sm flex flex-col gap-2">
          <a href="#" className="text-light-accent dark:text-dark-accent underline">Selling Guidelines</a>
          <a href="#" className="text-light-accent dark:text-dark-accent underline">Shipping Best Practices</a>
          <a href="#" className="text-light-accent dark:text-dark-accent underline">Contact Support / Discord</a>
        </div>
      </div>

      {/* ---- (3) PAGINATION ---- */}
      {tab !== "orders" && pageCount > 1 && (
        <div className="flex justify-center mb-7 gap-2">
          {[...Array(pageCount)].map((_, idx) => (
            <button
              key={idx}
              className={`px-3 py-1 rounded-full border font-bold transition
                ${page === idx + 1
                  ? "bg-light-accent dark:bg-dark-accent text-white border-light-accent dark:border-dark-accent"
                  : "bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text border-light-border dark:border-dark-border hover:bg-light-border dark:hover:bg-dark-border"}
              `}
              onClick={() => setPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* ---- (4) BULK ACTIONS ---- */}
      {tab === "active" && paged.length > 0 && (
        <div className="flex gap-2 mb-5">
          <button className="px-4 py-2 rounded bg-purple-700 text-white font-bold">End Selected</button>
          <button className="px-4 py-2 rounded bg-light-error text-white font-bold">Delete Selected</button>
        </div>
      )}

      {/* ---- (6) MINI-ANALYTICS (Demo) ---- */}
      <div className="mb-10">
        <h3 className="text-lg font-bold mb-2 text-light-primary dark:text-dark-primary flex items-center gap-2"><BarChart className="w-5 h-5" /> Analytics & Insights</h3>
        <div className="bg-light-alt dark:bg-dark-alt rounded-xl p-4 shadow text-sm flex gap-8">
          <div>
            <div className="font-bold text-xl text-light-accent dark:text-dark-accent">12</div>
            <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Sold This Month</div>
          </div>
          <div>
            <div className="font-bold text-xl text-light-success dark:text-dark-success">£324.00</div>
            <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Total Sales</div>
          </div>
          <div>
            <div className="font-bold text-xl text-light-primary dark:text-dark-primary">Charizard GX</div>
            <div className="text-xs text-light-textMuted dark:text-dark-textMuted">Top Card Sold</div>
          </div>
        </div>
      </div>

      {/* ---- (10) MOBILE-RESPONSIVE DESIGN: uses responsive classes throughout ---- */}

      {/* ---- LISTINGS GRID (with dummy checkboxes for bulk actions) ---- */}
      {tab !== "orders" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-7">
          {paged.length === 0 && (
            <div className="col-span-full text-center py-16 text-lg text-light-textMuted dark:text-dark-textMuted">
              No {tab} listings found.
            </div>
          )}
          {paged.map((listing) => {
            const card = listing.card || {};
            const img =
              card?.images?.large ??
              card?.images?.small ??
              card?.image ??
              card?.tcgImageUrl ??
              ""; // CHANGED
            const setLabel =
              card?.set?.name ??
              card?.setName ??
              (card?.setCode ? String(card.setCode).toUpperCase() : ""); // CHANGED
            return (
              <div
                key={listing.id}
                className={`
                  rounded-2xl shadow p-5 flex flex-col bg-light-surface dark:bg-dark-surface border
                  border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent
                  transition relative
                `}
              >
                {/* Bulk actions checkbox */}
                {tab === "active" && (
                  <input type="checkbox" className="absolute top-4 left-4 w-5 h-5 rounded border-light-border dark:border-dark-border" />
                )}
                {/* Card Image */}
                <div className="flex justify-center mb-3">
                  <Image
                    src={getCardImageUrl(img, { cardName: card.name, cardId: card.id })}
                    alt={card.name}
                    width={80}
                    height={110}
                    className="rounded-xl shadow border border-light-border dark:border-dark-border"
                  />
                </div>
                {/* Card Info */}
                <div className="font-bold text-lg text-light-primary dark:text-dark-primary truncate text-center">
                  {card.name}
                </div>
                <div className="text-xs text-center text-light-textMuted dark:text-dark-textMuted mb-1">
                  {setLabel} &nbsp;|&nbsp; #{card.number}
                </div>
                <div className="flex justify-center items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${STATUS[listing.status]?.color}`}>
                    {STATUS[listing.status]?.icon} {STATUS[listing.status]?.label}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-light-alt dark:bg-dark-alt text-xs font-semibold ml-1">
                    {listing.type === "sale" ? "For Sale" : "For Trade"}
                  </span>
                </div>
                {listing.type === "sale" ? (
                  <div className="mt-1 mb-2 text-lg font-bold text-light-success dark:text-dark-success text-center">
                    £{Number(listing.price).toFixed(2)}
                  </div>
                ) : (
                  <div className="mt-1 mb-2 text-xs text-light-primary dark:text-dark-primary text-center">
                    Trade for: {listing.tradeTerms}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-4">
                  <button
                    className="flex-1 py-2 rounded-xl font-bold bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface hover:bg-light-accentLight dark:hover:bg-dark-accentLight shadow flex items-center gap-2 justify-center"
                    onClick={() => handleEdit(listing)}
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    className="flex-1 py-2 rounded-xl font-bold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text hover:bg-light-error/10 dark:hover:bg-dark-error/20 shadow flex items-center gap-2 justify-center"
                    onClick={() => handleRemove(listing.id)}
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- (5) QUICK ADD LISTING MODAL ---- */}
      {showAddModal && (
        <AddListingModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />
      )}
      {/* ---- (4) BULK ACTIONS - Functionality not implemented (UI only) ---- */}
      {/* ---- (EDIT MODAL) ---- */}
      {editModal && (
        <EditListingModal
          listing={editModal}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

// --------- EDIT LISTING MODAL (same as before) ---------
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
      <div className="relative bg-light-surface dark:bg-dark-surface rounded-2xl max-w-md w-full p-6 shadow-xl border border-light-border dark:border-dark-border">
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
              className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition w-full"
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

// --------- ADD NEW LISTING MODAL (for demo) ---------
function AddListingModal({ onClose, onAdd }) {
  const [name, setCardName] = useState("");
  const [setName, setSetName] = useState("");
  const [number, setNumber] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("sale");

  function handleSubmit(e) {
    e.preventDefault();
    onAdd({
      type,
      status: "active",
      price,
      card: {
        name,
        setCardName,
        number,
        image,
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="relative bg-light-surface dark:bg-dark-surface rounded-2xl max-w-md w-full p-6 shadow-xl border border-light-border dark:border-dark-border">
        <button
          className="absolute top-4 right-4 p-1 bg-light-alt dark:bg-dark-alt rounded-full hover:bg-light-border dark:hover:bg-dark-border transition"
          onClick={onClose}
        >
          <XCircle className="w-5 h-5 text-light-textSecondary dark:text-dark-textSecondary" />
        </button>
        <h2 className="text-xl font-bold mb-4">Add New Listing</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Card Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Set Name</label>
            <input
              type="text"
              required
              value={setCardName}
              onChange={e => setSetName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Card Number</label>
            <input
              type="text"
              required
              value={number}
              onChange={e => setNumber(e.target.value)}
              className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Card Image URL</label>
            <input
              type="text"
              value={image}
              onChange={e => setImage(e.target.value)}
              className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
              placeholder="/cards/your-image.png"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
            >
              <option value="sale">For Sale</option>
              <option value="trade">For Trade</option>
            </select>
          </div>
          {type === "sale" && (
            <div>
              <label className="block text-sm font-medium mb-1">Price (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full px-3 py-2 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt focus:outline-none"
              />
            </div>
          )}
          <div className="flex gap-3 mt-3">
            <button
              type="submit"
              className="px-4 py-2 bg-light-accent dark:bg-dark-accent text-white rounded font-semibold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition w-full"
            >
              Add Listing
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
