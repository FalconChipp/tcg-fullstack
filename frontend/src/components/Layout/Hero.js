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

// Hero slides: copy-focused on key flows
const slidesData = [
  {
    image: "/assets/HeroSlides/start.png",
    title: "Track, value, and own your Pokémon collection.",
    subtitle:
      "All your cards in one place — organised, valued, and ready to grow. Free to start, built for collectors.",
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
    subtitle: "Wishlist & wantlist keep your next pickups front and centre.",
    ctaText: "Open Wishlist",
    action: "wishlist",
  },
  {
    image: "/assets/HeroSlides/search.png",
    title: "Find any English card fast.",
    subtitle:
      "Search by set code & number or name — instantly, no account needed just to look around.",
    ctaText: "Search Cards",
    action: "search",
  },
];

const CTA_LOGGED_OUT = "Start free";

export default function HeroSection({ onOpenAuthModal }) {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const scrollToSearch = () => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("card-search");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    router.push("/search");
  };

  const handleCtaClick = (action) => {
    // Search slide: logged-out → scroll to search, not auth
    if (action === "search" && !user) {
      scrollToSearch();
      return;
    }

    // Other actions: logged-out → auth
    if (!user) {
      onOpenAuthModal?.();
      return;
    }

    // Logged-in routes
    if (action === "collection" || action === "binders" || action === "wishlist") {
      router.push(`/profile/${user.username}?tab=${action}`);
    } else if (action === "search") {
      router.push("/search");
    } else {
      router.push(`/profile/${user.username}`);
    }
  };

  return (
    <section
      className="relative w-full select-none"
      role="region"
      aria-roledescription="carousel"
      aria-label="Highlights"
    >
      <Swiper
        spaceBetween={0}
        slidesPerView={1}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 6500, pauseOnMouseEnter: true }}
        loop
        // Slightly shorter, more “hero” than full banner
        className="h-[50vh] min-h-[280px] md:h-[46vh] lg:h-[420px]"
      >
        {slidesData.map((slide, idx) => (
          <SwiperSlide
            key={idx}
            aria-label={`Slide ${idx + 1}: ${slide.title}`}
          >
            <div className="relative h-full flex items-stretch justify-center">
              {/* Background image */}
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
                style={{ pointerEvents: "none", userSelect: "none" }}
              />

              {/* Overlay gradient: a bit more subtle at top, stronger at bottom */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/50 to-black/30 dark:from-black/90 dark:via-black/60 dark:to-black/40 z-10" />

              {/* Content: left-aligned on desktop, centered on mobile */}
              <div className="relative z-20 w-full">
                <div className="mx-auto flex h-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
                  <div className="max-w-xl text-left md:text-left text-white">
                    {/* Small badge */}
                    <div className="inline-flex items-center rounded-full border border-white/30 bg-black/30 px-3 py-1 text-xs font-medium mb-3">
                      <span className="mr-1 text-sm" aria-hidden="true">
                        🇬🇧
                      </span>
                      Built for Pokémon collectors
                    </div>

                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2 tracking-tight drop-shadow-xl">
                      {slide.title}
                    </h1>

                    <p className="text-sm sm:text-base md:text-lg font-medium mb-5 text-white/90 drop-shadow">
                      {slide.subtitle}
                    </p>

                    {/* CTAs row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* Primary CTA */}
                      <button
                        onClick={() => handleCtaClick(slide.action)}
                        className="
                          inline-flex items-center justify-center px-5 py-2.5
                          rounded-full text-sm sm:text-base font-semibold
                          bg-light-accent hover:bg-light-accentLight text-white shadow
                          dark:bg-dark-accent dark:hover:bg-dark-accentLight
                          transition
                        "
                        tabIndex={0}
                        aria-label={user ? slide.ctaText : CTA_LOGGED_OUT}
                      >
                        {user ? slide.ctaText : CTA_LOGGED_OUT}
                      </button>

                      {/* Secondary CTA: always “Try card search” */}
                      <button
                        type="button"
                        onClick={scrollToSearch}
                        className="
                          inline-flex items-center justify-center px-4 py-2
                          rounded-full text-xs sm:text-sm font-medium
                          bg-white/10 hover:bg-white/20 text-white
                          border border-white/30
                          transition
                        "
                      >
                        Try card search
                      </button>
                    </div>

                    {/* Quick feature chips */}
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] sm:text-xs text-white/80">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                        🃏 Track your collection
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                        📚 Digital binders
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                        ⭐ Wishlist & wantlist
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                        📈 Pricing insights
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Soft gradient at bottom into page background */}
      <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent dark:from-black/70 z-20" />
    </section>
  );
}
