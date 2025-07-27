// /components/marketplace/useMarketplaceCart.js
"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "marketplaceCart";

export default function useMarketplaceCart() {
  const [cart, setCart] = useState([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setCart(JSON.parse(stored));
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  // Add listing if not already in cart
  function addToCart(listing) {
    setCart(prev =>
      prev.find(item => item.id === listing.id) ? prev : [...prev, listing]
    );
  }

  function removeFromCart(listingId) {
    setCart(prev => prev.filter(item => item.id !== listingId));
  }

  function clearCart() {
    setCart([]);
  }

  return { cart, addToCart, removeFromCart, clearCart };
}
