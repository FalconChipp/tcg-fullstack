"use client";
import React, { useState, useEffect, useContext, useRef } from "react";
import Link from "next/link";
import Image from "next/image"; // ⭐ IMAGE LOGO
import { useTheme } from "@/hooks/ThemeProvider";
import AuthModal from "../Auth/AuthModal";
import { setCookie } from "@/utils/cookieUtils";
import { AuthContext } from "../Auth/AuthProvider";
import UserSearchDropdown from "@/components/UserProfile/UserSearch";
import { useRouter } from "next/router";
import NotificationBell from "@/components/Notifications/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";

const HeaderNavLink = ({ href, children, isActive, id }) => (
  <Link
    id={id}
    href={href}
    aria-current={isActive ? "page" : undefined}
    className={`text-base font-medium px-3 py-2 border-b-2 transition
      ${
        isActive
          ? "text-light-accent dark:text-dark-accent border-light-accent dark:border-dark-accent font-semibold"
          : "text-light-text dark:text-dark-text border-transparent"
      }
      hover:text-light-accent dark:hover:text-dark-accent
      hover:border-light-accent dark:hover:border-dark-accent
    `}
  >
    {children}
  </Link>
);

export default function Header({ onStartTour }) {
  const { dark, toggleDark } = useTheme();
  const { user, setUser, loading, token } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { items: notifications, markAllRead: markAllNotificationsRead } = useNotifications({
    token,
    pollMs: 45000,
  });

  const router = useRouter();
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

  const MobileOverlay = () =>
    menuOpen ? (
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-300"
        onClick={() => setMenuOpen(false)}
      />
    ) : null;

  return (
    <>
      <header
        id="main-header"
        className={`
          fixed top-0 left-0 w-full z-50
          transition-all duration-300 border-b
          ${
            isScrolled
              ? "shadow-xl bg-light-surface/90 dark:bg-dark-surface/90 border-light-border dark:border-dark-border backdrop-blur"
              : "bg-light-surface dark:bg-dark-surface border-transparent"
          }
        `}
      >
        <div className="relative">

          {/* ⭐ IMAGE LOGO — positioned far-left */}
          <Link
            href="/"
            className="
              absolute left-3 sm:left-6 top-1/2 -translate-y-1/2
              flex items-center
            "
            aria-label="SixByFive TCG Home"
          >
            {/* Single version (white logo always) */}
            <Image
              src="/assets/tcg-logo-white.png"
              alt="SixByFive TCG"
              width={165}
              height={40}
              className="object-contain"
              priority
            />
          </Link>

          {/* Add left padding so the nav stays aligned correctly */}
          <div className="max-w-7xl mx-auto pl-20 pr-4 sm:pr-6">
            <div className="flex items-center justify-between h-20">

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
                <HeaderNavLink href="/" isActive={pathname === "/"}>Home</HeaderNavLink>
                <HeaderNavLink href="/search" isActive={pathname === "/search"}>Search</HeaderNavLink>
                <HeaderNavLink href="/about" isActive={pathname === "/about"}>About</HeaderNavLink>
                <HeaderNavLink href="/sets" isActive={pathname === "/sets"}>All Sets</HeaderNavLink>
                {/* <HeaderNavLink href="/marketplace" isActive={pathname === "/marketplace"}>Marketplace</HeaderNavLink> */}
                <HeaderNavLink href="/blog" isActive={pathname === "/blog"}>Blog</HeaderNavLink>
              </nav>

              {/* Search */}
              <div className="hidden md:block flex-1 max-w-md mx-8">
                <UserSearchDropdown />
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 md:gap-3">
                {user && (
                  <NotificationBell
                    notifications={notifications}
                    onMarkAllRead={markAllNotificationsRead}
                  />
                )}

                {loading ? (
                  <div className="animate-pulse h-8 w-20 bg-light-border dark:bg-dark-border rounded" />
                ) : user ? (
                  <div className="relative">
                    <div className="flex items-center gap-1 px-1 py-1 rounded-xl">
                      <button
                        onClick={() => setUserDropdownOpen((v) => !v)}
                        className="flex items-center gap-2 py-1 px-3 rounded-full hover:bg-light-alt dark:hover:bg-dark-alt"
                      >
                        <span>{user.username}</span>
                        <i className="fas fa-chevron-down text-xs ml-1" />
                      </button>
                    </div>

                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl shadow-lg bg-light-surface dark:bg-dark-surface border py-2 z-30 animate-fadeIn">
                        <Link href={`/profile/${user.username}`} className="block px-4 py-2 hover:text-light-accent">
                          Profile
                        </Link>
                        <Link href="/account" className="block px-4 py-2 hover:text-light-accent">
                          Account Details
                        </Link>
                        <button onClick={onStartTour} className="block w-full text-left px-4 py-2 hover:bg-light-accent hover:text-white">
                          Redo Onboarding Tour
                        </button>
                        <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 hover:bg-light-error hover:text-white">
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-light-accent hover:bg-light-accentLight text-white"
                  >
                    Start free
                  </button>
                )}

                {/* Settings */}
                {/* <div
                  className="relative"
                  onMouseEnter={() => {
                    if (settingsTimeoutRef.current)
                      clearTimeout(settingsTimeoutRef.current);
                    setSettingsDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    settingsTimeoutRef.current = setTimeout(
                      () => setSettingsDropdownOpen(false),
                      250
                    );
                  }}
                >
                  <button className="text-lg rounded-full p-2 hover:bg-light-alt dark:hover:bg-dark-alt">
                    <i className="fas fa-cog" />
                  </button>

                  {settingsDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg bg-light-surface dark:bg-dark-surface border p-4 z-30 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span>Dark Mode</span>
                        <button
                          onClick={toggleDark}
                          className="relative inline-flex h-6 w-11 items-center rounded-full bg-light-border dark:bg-dark-border"
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
                </div> */}

                {/* Mobile menu button */}
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="md:hidden text-lg rounded-full p-2 hover:bg-light-alt dark:hover:bg-dark-alt"
                >
                  <i className="fas fa-bars" />
                </button>
              </div>
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
          transform transition-transform duration-300
          ${menuOpen ? "translate-x-0" : "translate-x-full"}
          bg-light-surface dark:bg-dark-surface shadow-2xl border-l
        `}
        style={{ maxWidth: "90vw" }}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-light-alt dark:hover:bg-dark-alt">
              <i className="fas fa-times" />
            </button>
          </div>

          <nav className="flex flex-col space-y-4 flex-grow">
            <HeaderNavLink href="/" isActive={pathname === "/"}>Home</HeaderNavLink>
            <HeaderNavLink href="/about" isActive={pathname === "/about"}>About</HeaderNavLink>
            <HeaderNavLink href="/sets" isActive={pathname === "/sets"}>All Sets</HeaderNavLink>
            <HeaderNavLink href="/marketplace" isActive={pathname === "/marketplace"}>Marketplace</HeaderNavLink>
          </nav>

          <div className="mt-auto pt-8">
            {user ? (
              <>
                <p className="mb-2 text-sm">Signed in as <b>{user.username}</b></p>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 rounded-lg bg-light-error text-white hover:bg-light-error/90"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setAuthModalOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 rounded-lg bg-light-accent hover:bg-light-accentLight text-white"
              >
                Start free
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

      {/* Animations */}
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.18s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
