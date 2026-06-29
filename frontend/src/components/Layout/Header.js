"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";

import { setCookie } from "@/utils/cookieUtils";
import { AuthContext } from "../Auth/AuthProvider";
import NotificationBell from "@/components/Notifications/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { useMessenger } from "@/components/Messenger/MessengerContext";

/* ----------------------------- Icons ----------------------------- */

function MenuIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ----------------------------- Helpers ----------------------------- */

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function safeFocusClass() {
  return (
    "outline-none focus:outline-none active:outline-none " +
    "focus:ring-0 active:ring-0 " +
    "focus-visible:outline-none focus-visible:ring-0 " +
    "select-none"
  );
}

function HeaderNavLink({ href, children, isActive, onClick, mobile = false }) {
  if (mobile) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={`header-clickable flex items-center justify-between rounded-[10px] px-4 py-3 text-base font-semibold transition-colors ${safeFocusClass()} ${
          isActive
            ? "bg-vault-raised text-vault-accent"
            : "text-vault-textSecondary hover:bg-vault-raised hover:text-vault-text active:bg-vault-raised"
        }`}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`header-clickable relative inline-flex h-20 items-center px-4 font-vault text-sm font-semibold transition-colors ${safeFocusClass()} ${
        isActive
          ? "text-vault-text after:absolute after:bottom-0 after:left-4 after:right-4 after:h-[2px] after:bg-vault-accent"
          : "text-vault-textSecondary hover:text-vault-text"
      }`}
    >
      {children}
    </Link>
  );
}

function HeaderAccountLink({ href, children, isActive }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`header-clickable hidden h-11 items-center rounded-[6px] px-2 text-sm font-semibold transition-colors ${safeFocusClass()} xl:inline-flex ${
        isActive
          ? "text-vault-accent"
          : "text-vault-textSecondary hover:text-vault-text active:text-vault-text"
      }`}
    >
      {children}
    </Link>
  );
}

/* ----------------------------- Component ----------------------------- */

export default function Header({ onStartTour }) {
  const { user, setUser, loading, token, openAuthModal: openAuthModalCtx } = useContext(AuthContext);

  const router = useRouter();
  const pathname = router.pathname;

  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const dropdownRef = useRef(null);

  const {
    items: notifications,
    unread,
    markAllRead: markAllNotificationsRead,
    markOneRead: markNotificationRead,
    dismissOne: dismissNotification,
    loadMore: loadMoreNotifications,
    hasMore,
    loadingMore,
  } = useNotifications({ token, pollMs: 45000 });

  const { openSidebar: openMessenger } = useMessenger();

  useEffect(() => {
    if (router.query.verify === "1") {
      openAuthModalCtx();
    }
  }, [router.query.verify]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!userDropdownOpen) return;

    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [userDropdownOpen]);

  function isActive(path) {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  function handleNotificationClick(notification) {
    if (!notification) return;

    if (notification.id) {
      markNotificationRead(notification.id);
    }

    if (notification.linkUrl) {
      if (notification.linkUrl === '#messenger') {
        openMessenger();
      } else if (isExternalUrl(notification.linkUrl)) {
        window.open(notification.linkUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(notification.linkUrl);
      }
    }
  }

  function handleNotificationDismiss(notification) {
    if (!notification?.id) return;
    dismissNotification(notification.id);
  }

  function handleSignOut() {
    setUser(null);
    setCookie("authToken", "", -1);
    setCookie("refreshToken", "", -1);
    setUserDropdownOpen(false);
    setMenuOpen(false);
  }

  function openAuthModal() {
    openAuthModalCtx();
    setMenuOpen(false);
  }

  const profileHref = user?.username ? `/profile/${user.username}` : "/profile";

  const desktopNav = user
    ? [
        { href: "/search", label: "Search" },
        { href: "/marketplace", label: "Marketplace" },
        { href: "/sets", label: "All Sets" },
        { href: "/subscriptions", label: "Subscriptions" },
      ]
    : [
        { href: "/search", label: "Search" },
        { href: "/marketplace", label: "Marketplace" },
        { href: "/sets", label: "All Sets" },
        { href: "/subscriptions", label: "Subscriptions" },
      ];

  const mobileNav = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: profileHref, label: "Profile" },
        { href: "/search", label: "Search cards" },
        { href: "/marketplace", label: "Marketplace" },
        { href: "/sets", label: "All Sets" },
        { href: "/account", label: "Account settings" },
      ]
    : [
        { href: "/search", label: "Search cards" },
        { href: "/marketplace", label: "Marketplace" },
        { href: "/sets", label: "All Sets" },
        { href: "/subscriptions", label: "Subscriptions" },
        { href: "/about", label: "About" },
      ];

  return (
    <>
      <header
        id="main-header"
        className={`fixed left-0 top-0 z-50 w-full border-b transition-colors duration-200 ${
          isScrolled
            ? "border-vault-border bg-vault-surface"
            : "border-transparent bg-vault-bg"
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-7">
          <div className="flex h-20 items-center gap-6">
            {/* Logo */}
            <Link
              href="/"
              className={`header-clickable flex shrink-0 items-center ${safeFocusClass()}`}
              aria-label="SixByFive TCG Home"
            >
              <Image
                src="/assets/tcg-logo-white.png"
                alt="SixByFive TCG"
                width={175}
                height={44}
                className="h-11 w-auto object-contain"
                priority
              />
            </Link>

            {/* Left desktop nav */}
            <nav
              className="hidden h-full items-center lg:flex"
              aria-label="Primary navigation"
            >
              {desktopNav.map((item) => (
                <HeaderNavLink
                  key={item.href}
                  href={item.href}
                  isActive={isActive(item.href)}
                >
                  {item.label}
                </HeaderNavLink>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Right side */}
            <div className="ml-auto flex items-center gap-4">
              {user && (
                <NotificationBell
                  notifications={notifications}
                  onMarkAllRead={markAllNotificationsRead}
                  onItemClick={handleNotificationClick}
                  onDismiss={handleNotificationDismiss}
                  onLoadMore={loadMoreNotifications}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  unreadCount={unread}
                />
              )}

              {user && (
                <div className="hidden items-center gap-4 xl:flex">
                  <HeaderAccountLink
                    href="/dashboard"
                    isActive={isActive("/dashboard")}
                  >
                    Dashboard
                  </HeaderAccountLink>

                  <HeaderAccountLink
                    href={profileHref}
                    isActive={isActive(profileHref)}
                  >
                    Profile
                  </HeaderAccountLink>
                </div>
              )}

              {loading ? (
                <div className="hidden h-11 w-28 animate-pulse rounded-[10px] bg-vault-raised sm:block" />
              ) : user ? (
                <div className="relative hidden sm:block" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen((v) => !v)}
                    className={`header-clickable inline-flex h-11 items-center gap-2 rounded-[10px] border border-vault-border bg-transparent px-4 text-sm font-semibold text-vault-text transition-colors hover:border-vault-borderStrong ${safeFocusClass()}`}
                    aria-expanded={userDropdownOpen}
                    aria-haspopup="true"
                  >
                    <span className="max-w-[130px] truncate">
                      {user.username}
                    </span>

                    <ChevronDownIcon
                      className={`transition-transform ${
                        userDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-[10px] border border-vault-border bg-vault-overlay py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] animate-fadeIn">
                      <div className="border-b border-vault-border px-4 pb-3 pt-1">
                        <p className="text-xs text-vault-textTertiary">
                          Signed in as
                        </p>
                        <p className="truncate text-sm font-semibold text-vault-text">
                          {user.username}
                        </p>
                      </div>

                      <Link
                        href="/account"
                        onClick={() => setUserDropdownOpen(false)}
                        className={`header-clickable block px-4 py-2.5 text-sm font-medium text-vault-textSecondary transition-colors hover:bg-vault-raised hover:text-vault-text ${safeFocusClass()}`}
                      >
                        Account settings
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          onStartTour?.();
                          setUserDropdownOpen(false);
                        }}
                        className={`header-clickable block w-full px-4 py-2.5 text-left text-sm font-medium text-vault-textSecondary transition-colors hover:bg-vault-raised hover:text-vault-text ${safeFocusClass()}`}
                      >
                        Redo onboarding tour
                      </button>

                      <div className="my-1 border-t border-vault-border" />

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className={`header-clickable block w-full px-4 py-2.5 text-left text-sm font-semibold text-vault-danger transition-colors hover:bg-vault-raised ${safeFocusClass()}`}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className={`header-clickable hidden h-11 rounded-[10px] bg-vault-accent px-5 text-sm font-semibold text-vault-text transition-colors hover:bg-vault-accentHover sm:inline-flex sm:items-center ${safeFocusClass()}`}
                >
                  Sign In / Sign Up
                </button>
              )}

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`header-clickable inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-vault-border bg-transparent text-vault-text transition-colors hover:border-vault-borderStrong lg:hidden ${safeFocusClass()}`}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile menu */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-80 max-w-[90vw] transform border-l border-vault-border bg-vault-overlay shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-transform duration-300 lg:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="flex h-full flex-col p-5">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className={`header-clickable flex items-center ${safeFocusClass()}`}
              aria-label="SixByFive TCG Home"
            >
              <Image
                src="/assets/tcg-logo-white.png"
                alt="SixByFive TCG"
                width={165}
                height={42}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className={`header-clickable inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-vault-text hover:bg-vault-raised ${safeFocusClass()}`}
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {mobileNav.map((item) => (
              <HeaderNavLink
                key={item.href}
                href={item.href}
                isActive={isActive(item.href)}
                onClick={() => setMenuOpen(false)}
                mobile
              >
                {item.label}
              </HeaderNavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-vault-border pt-5">
            {user ? (
              <div className="space-y-3">
                <div className="rounded-[10px] bg-vault-raised p-4">
                  <p className="text-xs text-vault-textTertiary">Signed in as</p>
                  <p className="truncate text-base font-semibold text-vault-text">
                    {user.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`header-clickable w-full rounded-[10px] border border-vault-danger/40 px-4 py-3 text-sm font-semibold text-vault-danger transition-colors hover:bg-vault-danger/10 ${safeFocusClass()}`}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className={`header-clickable w-full rounded-[10px] bg-vault-accent px-4 py-3 text-sm font-semibold text-vault-text transition-colors hover:bg-vault-accentHover ${safeFocusClass()}`}
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      </aside>


      <style jsx global>{`
        #main-header a,
        #main-header button,
        .header-clickable {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          outline: none !important;
          box-shadow: none !important;
        }

        #main-header a:focus,
        #main-header a:active,
        #main-header a:focus-visible,
        #main-header button:focus,
        #main-header button:active,
        #main-header button:focus-visible,
        .header-clickable:focus,
        .header-clickable:active,
        .header-clickable:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          -webkit-tap-highlight-color: transparent;
        }

        #main-header a::selection,
        #main-header button::selection,
        .header-clickable::selection {
          background: transparent;
        }

        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}