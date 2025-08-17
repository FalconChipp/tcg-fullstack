"use client";
import React, { useContext } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import SwiperCore from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { AuthContext } from "@/components/Auth/AuthProvider";
import { useRouter } from "next/router";

SwiperCore.use([Navigation, Pagination, Autoplay]);

// CHANGED: benefit-first copy + keep your imagery
const slidesData = [
  {
    image: "/assets/HeroSlides/start.png",
    // CHANGED: headline/subhead tuned for acquisition
    title: "Track, value, and show off your Pokémon collection.",
    subtitle:
      "Add cards in seconds. Build shareable binders. Stay on top of prices. Free to start.",
    // CHANGED: this label is used only when the user is logged in (see below)
    ctaText: "Open My Collection",
    action: "collection",
  },
  {
    image: "/assets/HeroSlides/binder.png",
    title: "Build digital binders that feel real.",
    subtitle:
      "Layouts, covers, and pages you can share — just like your real binders.",
    ctaText: "Go to Binders",
    action: "binders",
  },
  {
    image: "/assets/HeroSlides/wishlist.png",
    title: "Never lose a chase card again.",
    subtitle:
      "Wishlist & wantlist keep the next pickups front and centre.",
    ctaText: "Open Wishlist",
    action: "wishlist",
  },
  {
    image: "/assets/HeroSlides/search.png",
    title: "Find any English card fast.",
    subtitle:
      "Search by set code & number or name — instantly.",
    ctaText: "Search Cards",
    action: "search",
  },
];

// NEW: unified primary CTA when logged out (opens auth)
const CTA_LOGGED_OUT = "Start free";
// NEW: optional secondary CTA (low emphasis) for curiosity path
const SECONDARY_CTA_LABEL = "Browse public collections"; // TODO: update href below if your route differs

export default function HeroSection({ onOpenAuthModal }) {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  // Main CTA click handler (kept as-is, just commented)
  const handleCtaClick = (action) => {
    if (!user) {
      // CHANGED: always funnel logged-out users to sign-up
      onOpenAuthModal?.();
      return;
    }
    if (action === "collection" || action === "binders" || action === "wishlist") {
      router.push(`/profile/${user.username}?tab=${action}`);
    } else if (action === "search") {
      router.push("/search");
    } else {
      router.push(`/profile/${user.username}`);
    }
  };

  return (
    // NEW: aria landmarks to clarify the carousel’s role
    <section className="relative w-full select-none" role="region" aria-roledescription="carousel" aria-label="Highlights">
      <Swiper
        spaceBetween={0}
        slidesPerView={1}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 6500, pauseOnMouseEnter: true }} // CHANGED: pause on hover to reduce frustration
        loop
        className="h-[44vh] min-h-[260px] md:h-[38vh]"
      >
        {slidesData.map((slide, idx) => (
          <SwiperSlide key={idx} aria-label={`Slide ${idx + 1}: ${slide.title}`}>
            <div className="relative h-[44vh] min-h-[260px] md:h-[38vh] flex items-center justify-center">
              <img
                src={slide.image}
                alt={slide.title} // CHANGED: keep alt meaningful
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
                style={{ pointerEvents: "none", userSelect: "none" }}
              />
              {/* Overlay: neutral gradients */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/10 dark:from-black/90 dark:via-black/45 dark:to-black/20 z-10" />
              {/* Centered Content */}
              <div
                className="relative z-20 flex flex-col items-center justify-center text-center w-full max-w-2xl px-6 mx-auto"
                aria-live="polite" // NEW: announce slide content changes without being intrusive
              >
                <h1 className="text-white drop-shadow-xl text-xl sm:text-2xl md:text-3xl font-extrabold mb-1 tracking-tight">
                  {slide.title}
                </h1>
                <p className="text-white/90 text-sm sm:text-base md:text-lg font-medium mb-4 drop-shadow">
                  {slide.subtitle}
                </p>

                {/* CHANGED: CTA logic — logged out always sees "Start free" */}
                <button
                  onClick={() => handleCtaClick(slide.action)}
                  className="
                    inline-block px-5 py-2 rounded-full text-base font-semibold
                    bg-light-accent hover:bg-light-accentLight text-white shadow
                    dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white
                    transition
                  "
                  tabIndex={0}
                  aria-label={user ? slide.ctaText : CTA_LOGGED_OUT} // NEW
                >
                  {user ? slide.ctaText : CTA_LOGGED_OUT}
                </button>

                {/* NEW: subtle secondary link to reduce friction for curious visitors */}
                {/* <div className="mt-2">
                  <a
                    href="/collections/public" // TODO: update if your public route differs
                    className="text-white/80 hover:text-white underline underline-offset-4 text-sm"
                  >
                    {SECONDARY_CTA_LABEL}
                  </a>
                </div> */}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Neutral overlay at bottom */}
      <div className="absolute left-0 right-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent dark:from-black/60 z-20 pointer-events-none" />
    </section>
  );
}
