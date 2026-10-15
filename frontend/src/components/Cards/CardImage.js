"use client";

// Card image with a Pokémon-sprite fallback:
//   [ sprite ]
//   Name
//   SET
// Shown when there is no src, src is the generic placeholder, or the image fails to load.

import React, { useEffect, useState } from "react";
import { getPokemonSpriteUrl, setAbbrFromCardId } from "@/utils/pokemonSprite";

const PLACEHOLDER = "/images/card-placeholder.svg";

export default function CardImage({
  src,
  name,
  cardId,
  setCode,
  alt,
  className = "",
  fallbackClassName = "",
  compact = false,
  imgProps = {},
}) {
  const [failed, setFailed] = useState(false);
  const [spriteFailed, setSpriteFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const missing = !src || src === PLACEHOLDER || failed;

  if (!missing) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || name || "Card"}
        className={className}
        {...imgProps}
        onError={(e) => {
          setFailed(true);
          imgProps.onError?.(e);
        }}
      />
    );
  }

  // When the image is absolutely positioned (replacing a next/image `fill`), fill the parent the same way.
  const fillParent = /absolute/.test(className);
  const sprite = getPokemonSpriteUrl(name);
  const abbr = (setCode || setAbbrFromCardId(cardId) || "").toUpperCase();

  return (
    <div
      role="img"
      aria-label={name || "Card"}
      className={`flex flex-col items-center justify-center gap-1 ${compact ? "p-0.5" : "p-2"} text-center ${fillParent ? "absolute inset-0" : "w-full h-full"} ${fallbackClassName}`}
    >
      {sprite && !spriteFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sprite}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setSpriteFailed(true)}
          className={compact ? "w-full h-full object-contain" : "w-3/5 max-h-[50%] object-contain"}
        />
      ) : compact ? (
        <span aria-hidden className="text-base leading-none">🃏</span>
      ) : null}
      {!compact && (
        <>
          <span className="text-xs font-semibold leading-tight line-clamp-2">{name || "Unknown card"}</span>
          {abbr ? <span className="text-[10px] font-bold tracking-wide opacity-60">{abbr}</span> : null}
        </>
      )}
    </div>
  );
}
