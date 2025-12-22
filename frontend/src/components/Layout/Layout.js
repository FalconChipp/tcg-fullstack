"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/ThemeProvider";
import Header from "./Header";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import OnboardingTour from "../Onboarding/OnboardingTour";
import CookieBanner from "../Cookies/CookieBanner";
import CookieSettingsModal from "../Cookies/CookieSettings";
// import FullPageLayout from "../../../Archive/FullPageLayout";
import SEO from "@/components/SEO/SEO"; // NEW

// ✅ Seasonal wrapper for animated snow
import SnowBackground from "@/components/Seasonal/SnowBackground";

export default function Layout({
  children,
  hideBackTop = false,
  noTopPadding = false,
  seo = {}, // NEW: pass page-specific SEO overrides from pages
}) {
  const { dark } = useTheme();

  const [showSettingModal, setShowSettingModal] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  const onboardingRef = useRef();

  const startTour = () => onboardingRef.current?.startTour();

  // Apply dark mode class to html element
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (dark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
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
    // 🔄 Wrap the whole layout in the snow background
    <SnowBackground enabled={true}>
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

        <Footer onCookieSettingsClick={openSettingsModal} />

        {showSettingModal && (
          <CookieSettingsModal
            onClose={closeSettingModal}
            onSave={saveSettings}
          />
        )}

        {showSaveNotification && (
          <div className="save-notification fixed bottom-5 right-5 bg-green-600 text-white px-5 py-2.5 rounded-md shadow-md z-[1001] text-center">
            Your cookie settings have been saved.
          </div>
        )}

        {!hideBackTop && <BackToTop />}
      </div>
    </SnowBackground>
  );
}
