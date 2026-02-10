// frontend/src/components/Admin/AdminDashboardRoot.js
// -----------------------------------------------------------------------------
// Admin dashboard root.
// - Sidebar + topbar shell.
// - Hosts Overview, Users, Cards, Listings, Binders panels.
// -----------------------------------------------------------------------------

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

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "reports", label: "Reports" },
  { id: "orders", label: "Orders" },
  { id: "cards", label: "Collections" },
  { id: "products", label: "Products" },
  { id: "listings", label: "Listings" },
  { id: "binders", label: "Binders" },
  { id: "notifications", label: "Notifications" },
];

export default function AdminDashboardRoot() {
  const [activeSection, setActiveSection] = useState("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "users":
        return <AdminUsersPanel />;
      case "cards":
        return <AdminCardsPanel />;
      case "products":
        return <AdminProductsPanel />;
      case "listings":
        return <AdminListingsPanel />;
      case "binders":
        return <AdminBindersPanel />;
      case "orders":
        return <AdminOrdersPanel />;
      case "notifications":
        return <AdminNotificationsPanel />;
      case "reports": 
        return <AdminReportedUsersPanel />;
      case "overview":
      default:
        return <AdminOverviewPanel />;
    }
  };

  const activeLabel =
    SECTIONS.find((s) => s.id === activeSection)?.label || "Admin";

  return (
    <div className="min-h-screen flex bg-[#05060a] text-neutral-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 border-r border-white/5 bg-black/40 flex-col">
        <div className="px-4 py-4 border-b border-white/5">
          <p className="text-xs font-semibold tracking-widest uppercase text-neutral-400">
            SixByFive
          </p>
          <p className="mt-1 text-sm font-semibold">Admin Dashboard</p>
        </div>
        <nav className="flex-1 px-2 py-4 text-sm space-y-1">
          {SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={[
                  "w-full text-left px-3 py-2 rounded-lg transition",
                  isActive
                    ? "bg-white/10 text-neutral-50"
                    : "bg-transparent text-neutral-300 hover:bg-white/5",
                ].join(" ")}
              >
                {section.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile header nav */}
      <aside className="md:hidden border-b border-white/5 bg-black/40">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-neutral-400">
              SixByFive
            </p>
            <p className="text-xs font-semibold">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-1">
            {SECTIONS.map((section) => {
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={[
                    "px-2 py-1 rounded-md text-[11px] transition",
                    isActive
                      ? "bg-white/10 text-neutral-50"
                      : "bg-transparent text-neutral-300 border border-white/10",
                  ].join(" ")}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-white/5 bg-black/40 flex items-center px-4 md:px-6 justify-between">
          <h1 className="text-sm font-semibold">{activeLabel}</h1>
          <span className="text-xs text-neutral-400">
            <a href="https://tcg.sixbyfive.com">Return to main site</a>
          </span>
        </header>

        {/* Content */}
        <section className="flex-1 overflow-auto p-4 md:p-6">
          {renderSection()}
        </section>
      </main>
    </div>
  );
}
