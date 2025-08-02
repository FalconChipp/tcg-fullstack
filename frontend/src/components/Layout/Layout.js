'use client'; // Ensures this file is treated as a client component

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/ThemeProvider';
import Header from './Header';
import Footer from './Footer';
import BackToTop from './BackToTop';
import OnboardingTour from '../Onboarding/OnboardingTour';

import CookieBanner from '../Cookies/CookieBanner';
import CookieSettingsModal from '../Cookies/CookieSettings';
// import FullPageLayout from '../../../Archive/FullPageLayout';

export default function Layout({ children, hideBackTop = false, noTopPadding = false }) {
  const { dark } = useTheme();

  const [showSettingModal, setShowSettingModal] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Apply dark mode class to html element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [dark]);

  const openSettingsModal = () => {
    setShowSettingModal(true);
    setShowCookieBanner(false);
  };
  const closeSettingModal = () => setShowSettingModal(false);

  const acceptCookies = () => {
    // If needed, call setCookie('acceptCookies', 'true', 365);
    setShowCookieBanner(false);
  };

  const saveSettings = () => {
    // If needed, persist cookie settings here
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  return (
    <div className={`min-h-screen ${dark ? 'bg-dark-background text-dark-text' : 'bg-light-background text-light-text'}`}>
      <Header />
      <OnboardingTour />

      {showCookieBanner && (
        <CookieBanner onShowSettings={openSettingsModal} onAccept={acceptCookies} />
      )}

      {/* Conditional padding! */}
      <div className={`${noTopPadding ? 'pt-0' : 'pt-20 md:pt-20'} min-h-[calc(100vh-80px)]`}>
        {children}
      </div>

      <Footer onCookieSettingsClick={openSettingsModal} />

      {showSettingModal && (
        <CookieSettingsModal onClose={closeSettingModal} onSave={saveSettings} />
      )}

      {showSaveNotification && (
        <div className="save-notification fixed bottom-5 right-5 bg-green-600 text-white px-5 py-2.5 rounded-md shadow-md z-[1001] text-center">
          Your cookie settings have been saved.
        </div>
      )}

      {!hideBackTop && <BackToTop /> }
      {/* <BackToTop /> */}
    </div>
    // <FullPageLayout/>
  );
}
