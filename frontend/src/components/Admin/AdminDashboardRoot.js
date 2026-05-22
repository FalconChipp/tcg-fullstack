"use client";

import React, { useState } from "react";
import AdminOverviewPanel from "./AdminOverviewPanel";
import AdminUsersPanel from "./AdminUsersPanel";
import AdminCardsPanel from "./AdminCardsPanel";
import AdminListingsPanel from "./AdminListingsPanel";
import AdminBindersPanel from "./AdminBindersPanel";
import AdminProductsPanel from "./AdminProductsPanel";
import AdminOrdersPanel from "./AdminOrdersPanel";
import AdminNotificationsPanel from "./AdminNotificationsPanel";
import AdminReportedUsersPanel from "./AdminReportedUsersPanel";
import AdminProofQueuePanel from "./AdminProofQueuePanel";
import AdminSubscriptionsPanel from "./AdminSubscriptionsPanel";
import AdminRevenuePanel from "./AdminRevenuePanel";

// ─── Icon helpers (inline SVG, no dep) ───────────────────────────────────────

function Icon({ d, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const icons = {
  revenue:       "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  subscriptions: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z",
  overview:      "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 7-3.5-7H21z",
  users:         "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0a3 3 0 1 0 0-6M21 21v-2a3 3 0 0 0-2.25-2.9",
  reports:       "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01",
  orders:        "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  proofQueue:    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  listings:      "M4 6h16M4 12h16M4 18h7",
  products:      "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  collections:   "M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10",
  binders:       "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  notifications: "M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9",
};

// ─── Nav config ──────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      { id: "overview",      label: "Overview",      icon: "overview" },
    ],
  },
  {
    label: "Users",
    items: [
      { id: "users",         label: "Users",         icon: "users" },
      { id: "reports",       label: "Reports",       icon: "reports" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { id: "revenue",       label: "Revenue",       icon: "revenue" },
      { id: "subscriptions", label: "Subscriptions", icon: "subscriptions" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { id: "orders",        label: "Orders",        icon: "orders" },
      { id: "proof-queue",   label: "Proof Queue",   icon: "proofQueue" },
      { id: "listings",      label: "Listings",      icon: "listings" },
      { id: "products",      label: "Products",      icon: "products" },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "cards",         label: "Collections",   icon: "collections" },
      { id: "binders",       label: "Binders",       icon: "binders" },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "notifications", label: "Notifications", icon: "notifications" },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// ─── Panel map ───────────────────────────────────────────────────────────────

const PANELS = {
  overview:      <AdminOverviewPanel />,
  revenue:       <AdminRevenuePanel />,
  subscriptions: <AdminSubscriptionsPanel />,
  users:         <AdminUsersPanel />,
  cards:         <AdminCardsPanel />,
  products:      <AdminProductsPanel />,
  listings:      <AdminListingsPanel />,
  binders:       <AdminBindersPanel />,
  orders:        <AdminOrdersPanel />,
  notifications: <AdminNotificationsPanel />,
  reports:       <AdminReportedUsersPanel />,
  "proof-queue": <AdminProofQueuePanel />,
};

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ item, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100",
        isActive
          ? "bg-white/10 text-neutral-50 font-medium"
          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
      ].join(" ")}
    >
      <span className={isActive ? "text-neutral-200" : "text-neutral-500"}>
        <Icon d={icons[item.icon]} size={15} />
      </span>
      {item.label}
    </button>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardRoot() {
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = ALL_ITEMS.find((i) => i.id === activeSection);

  return (
    <div className="min-h-screen flex bg-[#06070c] text-neutral-50">
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-56 shrink-0 border-r border-white/[0.06] bg-black/50 flex-col">
        <div className="px-4 py-5 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-neutral-500">
            SixByFive
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-50">Admin</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    isActive={activeSection === item.id}
                    onClick={() => setActiveSection(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/[0.06]">
          <a
            href="https://tcg.sixbyfive.com"
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition"
          >
            ← Back to site
          </a>
        </div>
      </aside>

      {/* ── Mobile overlay sidebar ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 bg-[#08090f] border-r border-white/[0.06] flex flex-col z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-neutral-500">SixByFive</p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-50">Admin</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="text-neutral-500 hover:text-neutral-200"
              >
                <Icon d="M6 18L18 6M6 6l12 12" size={18} />
              </button>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavItem
                        key={item.id}
                        item={item}
                        isActive={activeSection === item.id}
                        onClick={() => { setActiveSection(item.id); setMobileOpen(false); }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 shrink-0 border-b border-white/[0.06] bg-black/40 flex items-center px-4 gap-3">
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden text-neutral-400 hover:text-neutral-200 mr-1"
            onClick={() => setMobileOpen(true)}
          >
            <Icon d="M3 12h18M3 6h18M3 18h18" size={18} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {activeItem && (
              <span className="text-neutral-500">
                <Icon d={icons[activeItem.icon]} size={14} />
              </span>
            )}
            <h1 className="text-sm font-semibold text-neutral-50 truncate">
              {activeItem?.label ?? "Admin"}
            </h1>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {PANELS[activeSection] ?? <AdminOverviewPanel />}
        </main>
      </div>
    </div>
  );
}
