import React from "react";
import Image from "next/image";
import { FaTrophy } from "react-icons/fa";

export default function ProfileShowcase({
  showcase = {},
  isOwnProfile,
  onEditShowcase,
  dark,
}) {
  const fallbackCard = "/assets/fallback-card.png";
  const fallbackBinder = "/assets/fallback-binder.png";
  const fallbackBadge = "/assets/fallback-badge.png";
  const { cards = [], binders = [], achievements = [], motto } = showcase;

  // Helpers for sections
  const Section = ({ title, items, fallbackImg, render, emptyText }) => (
    <div className="w-full md:w-auto flex-1 min-w-[200px]">
      <h3 className="text-lg font-black text-center mb-3 uppercase tracking-wider text-light-accent dark:text-dark-accent">
        {title}
      </h3>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-4 opacity-50 italic">
          <Image
            src={fallbackImg}
            alt={emptyText}
            width={80}
            height={80}
            className="rounded-xl object-contain mb-2"
          />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {items.map(render)}
        </div>
      )}
    </div>
  );

  return (
    <section
      className={`
        relative w-full rounded-3xl mb-10
        shadow-xl border
        ${dark
          ? "bg-gradient-to-br from-dark-surface via-[#222239] to-dark-background border-dark-border"
          : "bg-gradient-to-br from-white via-light-background to-light-alt border-light-border"}
        px-4 sm:px-10 py-7 overflow-hidden
      `}
    >
      {/* Floating edit button */}
      {isOwnProfile && (
        <button
          className={`
            absolute top-4 right-6 z-10 flex items-center gap-1 px-4 py-2 rounded-xl font-semibold text-xs shadow-lg
            ${dark
              ? "bg-dark-accent hover:bg-dark-accentLight text-white"
              : "bg-light-accentLight hover:bg-light-accent text-light-accent"}
            transition
          `}
          onClick={onEditShowcase}
          title="Edit Showcase"
        >
          <FaTrophy className="text-yellow-400 mr-1" />
          Edit Showcase
        </button>
      )}

      {/* Section header */}
      <h2 className="mb-8 text-2xl font-black tracking-tight text-center text-light-accent dark:text-dark-accent drop-shadow-sm uppercase">
        Showcase
      </h2>

      <div className="flex flex-col md:flex-row justify-center gap-8 md:gap-12">
        {/* Cards */}
        <Section
          title="Cards"
          items={cards}
          fallbackImg={fallbackCard}
          emptyText="No cards selected"
          render={(card, i) => (
            <div key={i} className="flex flex-col items-center glassy-card rounded-2xl p-2 shadow-md border border-light-accent/20 dark:border-dark-accent/20 bg-light-alt/60 dark:bg-dark-alt/80 group transition hover:scale-105 w-32">
              <div className="relative w-24 h-36 rounded-lg overflow-hidden border-4 border-yellow-300/60 shadow-lg bg-white dark:bg-dark-surface mb-2">
                <Image
                  src={card?.image || fallbackCard}
                  alt={card?.name || "Favorite Card"}
                  fill
                  className="object-contain"
                  sizes="100px"
                />
                <span className="absolute -top-2 -left-2 text-yellow-300 text-xl animate-pulse"><FaTrophy /></span>
              </div>
              <div className="text-xs font-bold text-center text-yellow-800 dark:text-yellow-200 truncate">{card?.name || "No Name"}</div>
              <div className="text-xs text-light-textMuted dark:text-dark-textMuted text-center truncate">{card?.setName || ""}</div>
            </div>
          )}
        />
        {/* Binders */}
        <Section
          title="Binders"
          items={binders}
          fallbackImg={fallbackBinder}
          emptyText="No binders selected"
          render={(binder, i) => (
            <div key={i} className="flex flex-col items-center glassy-card rounded-2xl p-2 shadow-md border border-light-accent/20 dark:border-dark-accent/20 bg-light-background/60 dark:bg-dark-alt/80 group transition hover:scale-105 w-28">
              <div className="relative w-24 h-16 aspect-[16/11] rounded-lg overflow-hidden border-4 border-light-accent/40 dark:border-dark-accent/40 shadow-lg bg-white dark:bg-dark-surface mb-2">
                <Image
                  src={binder?.coverImage || fallbackBinder}
                  alt={binder?.name || "Favorite Binder"}
                  fill
                  className="object-contain"
                  sizes="90px"
                />
              </div>
              <div className="text-xs font-bold text-center text-light-accent dark:text-dark-accent truncate">{binder?.name || "No Name"}</div>
              <div className="text-xs text-light-textMuted dark:text-dark-textMuted text-center truncate">
                {binder?.cardCount ? `${binder.cardCount} cards` : ""}
              </div>
            </div>
          )}
        />
        {/* Achievements */}
        <Section
          title="Achievements"
          items={achievements}
          fallbackImg={fallbackBadge}
          emptyText="No achievements yet"
          render={(badge, i) => (
            <div key={i} className="flex flex-col items-center glassy-card rounded-2xl p-2 shadow-md border border-light-accent/20 dark:border-dark-accent/20 bg-light-alt/80 dark:bg-dark-surface/80 group transition hover:scale-105 w-24">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-4 border-light-accent/40 dark:border-dark-accent/40 shadow bg-white dark:bg-dark-surface mb-2">
                <Image
                  src={badge?.image || fallbackBadge}
                  alt={badge?.title || "Achievement"}
                  fill
                  className="object-contain"
                  sizes="60px"
                />
                <span className="absolute top-0 right-0 text-light-accent dark:text-dark-accent text-lg animate-pulse"><FaTrophy /></span>
              </div>
              <div className="text-xs font-bold text-center text-light-accent dark:text-dark-accent truncate">{badge?.title || "No Title"}</div>
            </div>
          )}
        />
      </div>
      {/* Motto */}
      {motto && (
        <div className="
          mt-8 text-center italic text-lg px-2 py-3 mx-auto max-w-xl
          bg-light-accent/5 dark:bg-dark-accent/10
          rounded-lg border border-light-accent/20 dark:border-dark-accent/20
          text-light-text dark:text-dark-text shadow-inner
        ">
          “{motto}”
        </div>
      )}
    </section>
  );
}
