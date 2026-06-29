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
      <h3 className="text-lg font-black text-center mb-3 uppercase tracking-wider text-vault-accent">
        {title}
      </h3>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-4 opacity-50 italic">
          <Image
            src={fallbackImg}
            alt={emptyText}
            width={80}
            height={80}
            className="rounded-[10px] object-contain mb-2"
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
        relative w-full rounded-[14px] mb-10
         border
        ${dark
          ? "bg-gradient-to-br from-vault-surface via-[#222239] to-vault-bg border-vault-border"
          : "bg-gradient-to-br from-white via-vault-bg to-vault-raised border-vault-border"}
        px-4 sm:px-10 py-7 overflow-hidden
      `}
    >
      {/* Floating edit button */}
      {isOwnProfile && (
        <button
          className={`
            absolute top-4 right-6 z-10 flex items-center gap-1 px-4 py-2 rounded-[10px] font-semibold text-xs 
            ${dark
              ? "bg-vault-accent hover:bg-vault-accentHover text-white"
              : "bg-vault-accentHover hover:bg-vault-accent text-vault-accent"}
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
      <h2 className="mb-8 text-2xl font-black tracking-tight text-center text-vault-accent drop- uppercase">
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
            <div key={i} className="flex flex-col items-center glassy-card rounded-[10px] p-2  border border-vault-accent/20 dark:border-vault-accent/20 bg-vault-raised/60 dark:bg-vault-raised/80 group transition hover:scale-105 w-32">
              <div className="relative w-24 h-36 rounded-[6px] overflow-hidden border-4 border-yellow-300/60  bg-white dark:bg-vault-surface mb-2">
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
              <div className="text-xs text-vault-textTertiary text-center truncate">{card?.setName || ""}</div>
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
            <div key={i} className="flex flex-col items-center glassy-card rounded-[10px] p-2  border border-vault-accent/20 dark:border-vault-accent/20 bg-vault-bg/60 dark:bg-vault-raised/80 group transition hover:scale-105 w-28">
              <div className="relative w-24 h-16 aspect-[16/11] rounded-[6px] overflow-hidden border-4 border-vault-accent/40 dark:border-vault-accent/40  bg-white dark:bg-vault-surface mb-2">
                <Image
                  src={binder?.coverImage || fallbackBinder}
                  alt={binder?.name || "Favorite Binder"}
                  fill
                  className="object-contain"
                  sizes="90px"
                />
              </div>
              <div className="text-xs font-bold text-center text-vault-accent truncate">{binder?.name || "No Name"}</div>
              <div className="text-xs text-vault-textTertiary text-center truncate">
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
            <div key={i} className="flex flex-col items-center glassy-card rounded-[10px] p-2  border border-vault-accent/20 dark:border-vault-accent/20 bg-vault-raised/80 dark:bg-vault-surface/80 group transition hover:scale-105 w-24">
              <div className="relative w-16 h-16 rounded-[6px] overflow-hidden border-4 border-vault-accent/40 dark:border-vault-accent/40  bg-white dark:bg-vault-surface mb-2">
                <Image
                  src={badge?.image || fallbackBadge}
                  alt={badge?.title || "Achievement"}
                  fill
                  className="object-contain"
                  sizes="60px"
                />
                <span className="absolute top-0 right-0 text-vault-accent text-lg animate-pulse"><FaTrophy /></span>
              </div>
              <div className="text-xs font-bold text-center text-vault-accent truncate">{badge?.title || "No Title"}</div>
            </div>
          )}
        />
      </div>
      {/* Motto */}
      {motto && (
        <div className="
          mt-8 text-center italic text-lg px-2 py-3 mx-auto max-w-xl
          bg-vault-accent/5 dark:bg-vault-accent/10
          rounded-[6px] border border-vault-accent/20 dark:border-vault-accent/20
          text-vault-text -inner
        ">
          “{motto}”
        </div>
      )}
    </section>
  );
}
