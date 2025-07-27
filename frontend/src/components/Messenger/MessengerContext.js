// MessengerContext.js
"use client";
import { createContext, useContext, useState } from "react";

const MessengerContext = createContext();

export function MessengerProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <MessengerContext.Provider value={{
      sidebarOpen,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false),
    }}>
      {children}
    </MessengerContext.Provider>
  );
}

export function useMessenger() {
  return useContext(MessengerContext);
}
