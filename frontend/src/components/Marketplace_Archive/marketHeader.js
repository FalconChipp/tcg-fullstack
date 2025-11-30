// /components/Marketplace/marketHeader.js
"use client";
import React from "react";
import { FaShoppingCart } from "react-icons/fa";
import { useCart } from "./CartProvider";

export default function MarketplaceHeader({ onCartClick }) {
  const { cart } = useCart();
  const balance = 320.25; // Mock value

  return (
    <header
      className="
        sticky
        top-[80px] md:top-[80px] 
        z-40
        bg-light-surface/90 dark:bg-dark-surface/90 
        border-b border-light-border dark:border-dark-border 
        shadow-sm py-3
        backdrop-blur-sm
      "
      style={{ transition: "top 0.2s" }} // Optional for smooth top changes
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4">
        <div className="font-extrabold text-2xl text-light-primary dark:text-dark-primary tracking-tight">
          Marketplace
        </div>
        <div className="flex items-center gap-6">
          <div className="text-base text-light-success dark:text-dark-success font-bold">
            Balance: <span className="ml-1">£{balance.toFixed(2)}</span>
          </div>
          <button
            className="relative flex items-center px-3 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface font-bold hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition focus:outline-none"
            onClick={onCartClick}
            aria-label="View cart"
          >
            <FaShoppingCart className="text-xl" />
            <span className="ml-2">Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-xs text-white rounded-full px-2 py-0.5">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
