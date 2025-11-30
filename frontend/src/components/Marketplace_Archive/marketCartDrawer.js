// /components/Marketplace/marketCartDrawer.js
"use client";
import React from "react";
import { FaTimes, FaTrash } from "react-icons/fa";
import { useCart } from "./CartProvider";

export default function MarketCartDrawer({ open, onClose }) {
  const { cart, removeFromCart, clearCart } = useCart();

  return (
    <div
      className={`
        fixed inset-0 z-50 transition-all
        ${open ? "visible opacity-100" : "invisible opacity-0"}
      `}
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-40 transition-opacity ${open ? "" : "pointer-events-none"}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className={`
        fixed top-0 right-0 h-full w-full max-w-md bg-light-surface dark:bg-dark-surface
        shadow-2xl border-l border-light-border dark:border-dark-border z-50
        transform transition-transform duration-300
        ${open ? "translate-x-0" : "translate-x-full"}
        flex flex-col
      `}>
        <header className="flex items-center justify-between p-5 border-b border-light-border dark:border-dark-border">
          <h2 className="text-xl font-bold">Your Cart</h2>
          <button onClick={onClose} className="text-2xl text-light-textMuted dark:text-dark-textMuted hover:text-light-error dark:hover:text-dark-error">
            <FaTimes />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="text-center text-light-textMuted dark:text-dark-textMuted mt-20">Your cart is empty.</div>
          ) : (
            <ul className="space-y-4">
              {cart.map(item => (
                <li key={item.id} className="flex gap-4 items-center border-b border-light-border dark:border-dark-border pb-3">
                  <img src={item.cardImage} alt={item.cardName} className="w-14 h-20 object-contain rounded-lg bg-light-alt dark:bg-dark-alt" />
                  <div className="flex-1">
                    <div className="font-semibold">{item.cardName}</div>
                    <div className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      {item.setName} • #{item.cardNumber}
                    </div>
                    <div className="text-sm">{item.condition} • {item.language}</div>
                  </div>
                  <div className="font-bold text-light-accent dark:text-dark-accent">£{item.price.toFixed(2)}</div>
                  <button
                    className="ml-2 text-light-error dark:text-dark-error hover:text-red-600"
                    title="Remove"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="p-5 border-t border-light-border dark:border-dark-border">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-lg">Total:</span>
            <span className="font-bold text-lg text-light-accent dark:text-dark-accent">
              £{cart.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
            </span>
          </div>
          <button
            className="w-full py-3 rounded-xl bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface font-bold text-lg shadow hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition mb-2"
            disabled={cart.length === 0}
            // TODO: hook up to checkout
          >
            Checkout
          </button>
          <button
            className="w-full py-2 rounded-xl bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error font-bold text-sm hover:bg-light-error/20 dark:hover:bg-dark-error/20 transition"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            Clear Cart
          </button>
        </footer>
      </aside>
    </div>
  );
}
