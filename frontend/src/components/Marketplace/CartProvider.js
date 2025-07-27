// /components/Marketplace/CartProvider.js
"use client";
import React, { createContext, useContext } from "react";
import useMarketplaceCart from "@/hooks/useMarketplaceCart";

// Context
const CartContext = createContext();

export function CartProvider({ children }) {
  const cart = useMarketplaceCart();
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

// Custom hook for easy access
export function useCart() {
  return useContext(CartContext);
}
