// src/components/Layout/Layout.js
//
// UPDATED (2026-01-29):
// - FIXED: Removed extra fixed/inset overlay wrapper around <MessengerLayout />
//   That wrapper was causing the Messenger toggle/chat to appear in strange places (eg top-left)
//   and interfering with pointer-events.
// - KEEP: MessengerProvider remains wrapping the whole app so MessengerContext works everywhere.
// - KEEP: All existing layout behaviour unchanged.

"use client";

import React, { useContext, useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/ThemeProvider";
import { AuthContext } from "@/components/Auth/AuthProvider";
import AuthModal from "@/components/Auth/AuthModal";

import Header from "./Header";
import Footer from "./Footer";
import BackToTop from "./BackToTop";

import OnboardingTour from "../Onboarding/OnboardingTour";
import CookieBanner from "../Cookies/CookieBanner";
import CookieSettingsModal from "../Cookies/CookieSettings";

import SEO from "@/components/SEO/SEO";

// ✅ Ensure casing matches your actual folder name: /components/Messenger/...
import { MessengerProvider } from "@/components/Messenger/MessengerContext";
import MessengerLayout from "@/components/Messenger/MessengerLayout";

export default function Layout({
  children,
  hideBackTop = false,
  noTopPadding = false,
  seo = {},
}) {
  const { dark } = useTheme();
  const { authModalOpen, closeAuthModal } = useContext(AuthContext);

  const [showSettingModal, setShowSettingModal] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  const onboardingRef = useRef(null);
  const startTour = () => onboardingRef.current?.startTour?.();

  // Apply dark mode class to html element
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  const openSettingsModal = () => {
    setShowSettingModal(true);
    setShowCookieBanner(false);
  };

  const closeSettingModal = () => setShowSettingModal(false);

  const acceptCookies = () => {
    setShowCookieBanner(false);
  };

  const saveSettings = () => {
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  return (
    <MessengerProvider>
      <div
        className={
          dark
            ? "min-h-screen bg-dark-background text-dark-text"
            : "min-h-screen bg-light-background text-light-text"
        }
      >
        {/* Centralised SEO with per-page overrides via `seo` prop */}
        <SEO {...seo} />

        {/* Header + tour */}
        <Header onStartTour={startTour} />
        <OnboardingTour ref={onboardingRef} />

        {showCookieBanner && (
          <CookieBanner
            onShowSettings={openSettingsModal}
            onAccept={acceptCookies}
          />
        )}

        <div
          className={`${
            noTopPadding ? "pt-0" : "pt-20 md:pt-20"
          } min-h-[calc(100vh-80px)]`}
        >
          {children}
        </div>

        <MessengerLayout />

        <Footer onCookieSettingsClick={openSettingsModal} />

        {showSettingModal && (
          <CookieSettingsModal
            onClose={closeSettingModal}
            onSave={saveSettings}
          />
        )}

        {showSaveNotification && (
          <div className="save-notification fixed bottom-5 right-5 bg-green-600 text-white px-5 py-2.5 rounded-md shadow-md z-[10001] text-center">
            Your cookie settings have been saved.
          </div>
        )}

        {!hideBackTop && <BackToTop />}

        <AuthModal
          isOpen={authModalOpen}
          onClose={closeAuthModal}
          onAuthSuccess={closeAuthModal}
        />
      </div>
    </MessengerProvider>
  );
}
