"use client";
import React, { useState, useEffect, useContext, useRef } from "react";
import Link from "next/link";
import { useTheme } from "@/hooks/ThemeProvider";
import AuthModal from "../Auth/AuthModal";
import { setCookie } from "@/utils/cookieUtils";
import { AuthContext } from "../Auth/AuthProvider";
import UserSearchDropdown from "@/components/UserProfile/UserSearch";
import { useRouter } from "next/router";
import NotificationBell from "@/components/Notifications/NotificationBell";

// Helper for header nav links (neutral text, blue accent only for active/hover)
const HeaderNavLink = ({ href, children, isActive }) => (
  <Link
    href={href}
    className={`
      text-base font-medium px-3 py-2 border-b-2 transition
      ${isActive
        ? "text-light-accent dark:text-dark-accent border-light-accent dark:border-dark-accent font-semibold"
        : "text-light-text dark:text-dark-text border-transparent"}
      hover:text-light-accent dark:hover:text-dark-accent
      hover:border-light-accent dark:hover:border-dark-accent
    `}
  >
    {children}
  </Link>
);

export default function Header() {
  const { dark, toggleDark } = useTheme();
  const { user, setUser, loading } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const router = useRouter();

  const servicesTimeoutRef = useRef(null);
  const settingsTimeoutRef = useRef(null);

  useEffect(() => {
    if (router.query.verify === "1") setAuthModalOpen(true);
  }, [router.query.verify]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 32);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const pathname = router.pathname;

  const handleSignOut = () => {
    setUser(null);
    setCookie("authToken", "", -1);
    setCookie("refreshToken", "", -1);
    setUserDropdownOpen(false);
    setMenuOpen(false);
  };

  // Overlay for mobile menu
  const MobileOverlay = () =>
    menuOpen ? (
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-300"
        onClick={() => setMenuOpen(false)}
        aria-label="Close menu"
      />
    ) : null;

    const notifications = [
      { id: 1, type: "info",    title: "Card sold!",       body: "Your Pikachu VMAX has sold.", read: false, date: "2025-07-25T18:33:00Z" },
      { id: 2, type: "warning", title: "Action needed",    body: "Please verify your email.",   read: false, date: "2025-07-25T16:10:00Z" },
      { id: 3, type: "message", title: "New message",      body: "John sent you a message.",    read: true,  date: "2025-07-23T12:05:00Z" },
      { id: 4, type: "error",   title: "Payment failed",   body: "Stripe payment did not go through.", read: true, date: "2025-07-21T20:50:00Z" },
    ];

  return (
    <>
      {/* Main Header */}
      <header
        className={`
          fixed top-0 left-0 w-full z-50
          transition-all duration-300
          border-b
          ${
            isScrolled
              ? "shadow-xl bg-light-surface/90 dark:bg-dark-surface/90 border-light-border dark:border-dark-border backdrop-blur"
              : "bg-light-surface dark:bg-dark-surface border-transparent"
          }
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20">
            {/* Left: Logo and Nav */}
            <div className="flex items-center gap-8">
              {/* Logo: Always blue, but smaller 'TCG' uses lighter blue */}
              <Link
                href="/"
                className="flex items-center font-extrabold text-2xl tracking-tight
                  text-light-accent dark:text-dark-accent
                "
              >
                SIXBYFIVE
                <span className="ml-1 text-xs font-mono text-light-accentLight dark:text-dark-accentLight">TCG</span>
              </Link>
              {/* Desktop Nav: All nav text is neutral, blue only for accent/active */}
              <nav className="hidden md:flex items-center gap-1">
                <HeaderNavLink href="/" isActive={pathname === "/"}>Home</HeaderNavLink>
                <HeaderNavLink href="/about" isActive={pathname === "/about"}>About</HeaderNavLink>
                {/* <HeaderNavLink href="/subscriptions" isActive={pathname === "/subscriptions"}>Subscriptions</HeaderNavLink> */}
                {/* Services Dropdown */}
                {/* <div
                  className="relative"
                  onMouseEnter={() => {
                    if (servicesTimeoutRef.current) clearTimeout(servicesTimeoutRef.current);
                    setServicesDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    servicesTimeoutRef.current = setTimeout(
                      () => setServicesDropdownOpen(false), 250
                    );
                  }}
                >
                  <button
                    className={`
                      flex items-center text-base font-medium px-3 py-2 border-b-2 transition
                      ${pathname.startsWith("/services")
                        ? "text-light-accent dark:text-dark-accent border-light-accent dark:border-dark-accent font-semibold"
                        : "text-light-text dark:text-dark-text border-transparent"}
                      hover:text-light-accent dark:hover:text-dark-accent
                      hover:border-light-accent dark:hover:border-dark-accent
                      focus:outline-none
                    `}
                    tabIndex={0}
                  >
                    Services
                    <i className="fas fa-chevron-down ml-1 text-xs" />
                  </button>
                  {servicesDropdownOpen && (
                    <div
                      className="absolute left-0 top-full mt-2 w-48 rounded-xl z-20
                        shadow-lg border bg-light-surface dark:bg-dark-surface
                        dark:border-dark-border border-light-border
                        py-2 animate-fadeIn
                      "
                    >
                      <Link href="/services/sub1" className="block px-4 py-2 text-base text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent rounded transition-colors">Sub Service 1</Link>
                      <Link href="/services/sub2" className="block px-4 py-2 text-base text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent rounded transition-colors">Sub Service 2</Link>
                      <Link href="/services/sub3" className="block px-4 py-2 text-base text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent rounded transition-colors">Sub Service 3</Link>
                    </div>
                  )}
                </div> */}
                {/* <HeaderNavLink href="/contact" isActive={pathname === "/contact"}>Contact</HeaderNavLink> */}
              </nav>
            </div>
            {/* Center: User Search */}
            <div className="hidden md:block flex-1 max-w-md mx-8">
              <UserSearchDropdown />
            </div>

            {/* Right: Auth, Settings, Mobile */}
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="animate-pulse h-8 w-20 bg-light-border dark:bg-dark-border rounded" />
              ) : user ? (
                <div className="relative">
                  <div className="
                      flex items-center gap-2
                      px-4 py-2 rounded-xl transition text-base font-medium
                      bg-light-accent hover:bg-light-accentLight text-white
                      dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white
                      focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accentLight
                    ">
                  <button
                    className="hover:bg-light-border dark:hover:bg-dark-border py-1 px-3 rounded-full"
                    onClick={() => setUserDropdownOpen((v) => !v)}
                  >
                    <span>{user.username}</span>
                    <i className="fas fa-chevron-down text-xs ml-2" />
                    </button>
                    <NotificationBell notifications={notifications} />
                  </div>
                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-xl shadow-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border z-30 py-2 animate-fadeIn">
                      <Link href={`/profile/${user.username}`} className="block px-4 py-2 text-base text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent rounded transition-colors" onClick={() => setUserDropdownOpen(false)}>
                        Profile
                      </Link>
                      <Link href="/seller-dashboard" className="block px-4 py-2 text-base text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent rounded transition-colors" onClick={() => setUserDropdownOpen(false)}>
                        Seller Dashboard
                      </Link>
                      <Link href="/account" className="block px-4 py-2 text-base text-light-text dark:text-dark-text hover:text-light-accent dark:hover:text-dark-accent rounded transition-colors" onClick={() => setUserDropdownOpen(false)}>
                        Account Details
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-base hover:bg-light-error hover:text-white dark:hover:bg-dark-error dark:hover:text-white rounded transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="
                    px-4 py-2 rounded-xl shadow-sm transition text-base font-medium
                    bg-light-accent hover:bg-light-accentLight text-white
                    dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accentLight
                  "
                >
                  Sign In
                </button>
              )}
              {/* Theme Settings Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (settingsTimeoutRef.current) clearTimeout(settingsTimeoutRef.current);
                  setSettingsDropdownOpen(true);
                }}
                onMouseLeave={() => {
                  settingsTimeoutRef.current = setTimeout(
                    () => setSettingsDropdownOpen(false), 250
                  );
                }}
              >
                <button
                  className="text-lg rounded-full p-2 hover:bg-light-alt dark:hover:bg-dark-alt transition text-light-text dark:text-dark-text"
                  aria-label="Toggle settings"
                >
                  <i className="fas fa-cog" />
                </button>
                {settingsDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border p-4 z-30 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-medium text-light-text dark:text-dark-text">Dark Mode</span>
                      <button
                        onClick={toggleDark}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-light-border dark:bg-dark-border transition-colors focus:outline-none"
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full transition-transform
                            ${dark ? "bg-dark-accent translate-x-6" : "bg-light-accent translate-x-1"}
                          `}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Hamburger for Mobile */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="md:hidden text-lg rounded-full p-2 hover:bg-light-alt dark:hover:bg-dark-alt transition text-light-text dark:text-dark-text"
                aria-label="Open menu"
              >
                <i className="fas fa-bars" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Overlay */}
      <MobileOverlay />

      {/* Mobile Menu */}
      <div
        className={`
          fixed top-0 right-0 w-80 h-full z-50
          transform transition-transform duration-300 ease-in-out
          ${menuOpen ? "translate-x-0" : "translate-x-full"}
          bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text
          shadow-2xl border-l border-light-border dark:border-dark-border
        `}
        style={{ maxWidth: "90vw" }}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-light-text dark:text-dark-text">Menu</h2>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-lg rounded-full p-2 hover:bg-light-alt dark:hover:bg-dark-alt transition text-light-text dark:text-dark-text"
              aria-label="Close menu"
            >
              <i className="fas fa-times" />
            </button>
          </div>
          <nav className="flex flex-col space-y-4 flex-grow">
            <HeaderNavLink href="/" isActive={pathname === "/"}>Home</HeaderNavLink>
            <HeaderNavLink href="/about" isActive={pathname === "/about"}>About</HeaderNavLink>
            {/* <HeaderNavLink href="/subscriptions" isActive={pathname === "/subscriptions"}>Subscriptions</HeaderNavLink>
            <HeaderNavLink href="/contact" isActive={pathname === "/contact"}>Contact</HeaderNavLink> */}
          </nav>
          <div className="mt-auto pt-8">
            {user ? (
              <>
                <p className="mb-2 text-sm text-light-textMuted dark:text-dark-textMuted">Signed in as <b>{user.username}</b></p>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 rounded-lg transition-colors text-base
                    bg-light-error hover:bg-light-error/90 text-white
                    dark:bg-dark-error dark:hover:bg-dark-error/90 dark:text-white
                  "
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => { setAuthModalOpen(true); setMenuOpen(false); }}
                className="w-full px-4 py-2 rounded-lg shadow text-base
                  bg-light-accent hover:bg-light-accentLight text-white
                  dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white
                "
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={() => setAuthModalOpen(false)}
        />
      )}

      {/* Animate fade-in for dropdowns */}
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px);}
          to   { opacity: 1; transform: translateY(0);}
        }
      `}</style>
    </>
  );
}
