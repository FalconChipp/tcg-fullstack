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

const slidesData = [
  {
    image: "/assets/HeroSlides/start.png",
    title: "Your Pokémon Collection, Organised",
    subtitle: "Digitally track every card you own with beautiful, customisable binders.",
    ctaText: "Start Your Collection",
    action: "collection",
  },
  {
    image: "/assets/HeroSlides/binder.png",
    title: "Create Digital Binders",
    subtitle: "Design binders and layouts just like your real collection. Show off your sets online.",
    ctaText: "Go to Binders",
    action: "binders",
  },
  {
    image: "/assets/HeroSlides/wishlist.png",
    title: "Wishlist & Wantlist",
    subtitle: "Keep track of the cards you need next. Never forget a wanted card again.",
    ctaText: "Open Wishlist",
    action: "wishlist",
  },
  {
    image: "/assets/HeroSlides/search.png",
    title: "Advanced Card Search",
    subtitle: "Find any English Pokémon card by set, rarity, type, or number—fast.",
    ctaText: "Search Cards",
    action: "search",
  },
];

export default function HeroSection({ onOpenAuthModal }) {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  // Main CTA click handler
  const handleCtaClick = (action) => {
    if (!user) {
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
    <section className="relative w-full select-none">
      <Swiper
        spaceBetween={0}
        slidesPerView={1}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 6500 }}
        loop
        className="h-[44vh] min-h-[260px] md:h-[38vh]"
      >
        {slidesData.map((slide, idx) => (
          <SwiperSlide key={idx}>
            <div className="relative h-[44vh] min-h-[260px] md:h-[38vh] flex items-center justify-center">
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
                style={{ pointerEvents: "none", userSelect: "none" }}
              />
              {/* Overlay: neutral gradients (no blue/purple, just dark/gray) */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/10 dark:from-black/90 dark:via-black/45 dark:to-black/20 z-10"></div>
              {/* Centered Content */}
              <div className="relative z-20 flex flex-col items-center justify-center text-center w-full max-w-2xl px-6 mx-auto">
                <h1 className="text-white drop-shadow-xl text-xl sm:text-2xl md:text-3xl font-extrabold mb-1 tracking-tight">
                  {slide.title}
                </h1>
                <p className="text-white/90 text-sm sm:text-base md:text-lg font-medium mb-4 drop-shadow">
                  {slide.subtitle}
                </p>
                <button
                  onClick={() => handleCtaClick(slide.action)}
                  className="
                    inline-block px-5 py-2 rounded-full text-base font-semibold
                    bg-light-accent hover:bg-light-accentLight text-white shadow
                    dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white
                    transition
                  "
                  tabIndex={0}
                >
                  {slide.ctaText}
                </button>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      {/* Neutral overlay at bottom, no blue */}
      <div className="absolute left-0 right-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent dark:from-black/60 z-20 pointer-events-none" />
    </section>
  );
}
