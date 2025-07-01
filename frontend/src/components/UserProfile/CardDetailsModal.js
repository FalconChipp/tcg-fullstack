import React from 'react';
import Image from 'next/image';
import { formatVariation } from "@/utils/formatVariation";
import { formatCondition, getConditionClass } from "@/utils/formatCondition";
import { formatDate, formatRelativeTime } from "@/utils/formatDate";
import { getAverageCardValue } from '@/utils/priceUtil';

const FALLBACK_CARD_IMAGE = "/images/card-placeholder.svg";

export default function CardDetailsModal({ card, onClose, dark }) {
  const [imgSrc, setImgSrc] = React.useState(card?.modalImage || card?.tcgImageUrl || FALLBACK_CARD_IMAGE);
  const [imageLoading, setImageLoading] = React.useState(true);

  if (!card) return null;

  // --- Get all unique variations present on the card ---
  const variationKeys = React.useMemo(() => {
    const keys = new Set();
    if (Array.isArray(card.variations)) card.variations.forEach(v => keys.add(v));
    if (card.tcgplayerVariations) Object.keys(card.tcgplayerVariations).forEach(v => keys.add(v));
    if (card.cardmarketVariations) Object.keys(card.cardmarketVariations).forEach(v => keys.add(v));
    if (card.variation && !keys.has(card.variation)) keys.add(card.variation);
    if (keys.size === 0) keys.add("normal");
    return Array.from(keys);
  }, [card]);

  // --- Helper: get price for a given variation
  function getDisplayPriceForVariation(variation) {
    const tcg =
      card.tcgplayerVariations?.[variation]?.market ??
      (card.pricing?.tcgplayer?.market && card.variation === variation ? card.pricing.tcgplayer.market : null);
    const cmkt =
      card.cardmarketVariations?.[variation]?.average_sell ??
      (card.pricing?.cardmarket?.average_sell && card.variation === variation ? card.pricing.cardmarket.average_sell : null);
    return { tcg, cmkt };
  }

  // --- Main price logic
  let mainVariation = null;
  let tcgplayerMarket = card.tcgplayerMarket;
  let cardmarketAverageSell = card.cardmarketAverageSell;

  // If only one variation, use its values for the main price area
  if (variationKeys.length === 1) {
    mainVariation = variationKeys[0];
    const { tcg, cmkt } = getDisplayPriceForVariation(mainVariation);
    tcgplayerMarket = tcg;
    cardmarketAverageSell = cmkt;
  } else {
    // For multiple variations, default to "normal" or first with value
    mainVariation = "normal";
    if (tcgplayerMarket == null || cardmarketAverageSell == null) {
      for (let i = 0; i < variationKeys.length; ++i) {
        const { tcg, cmkt } = getDisplayPriceForVariation(variationKeys[i]);
        if (tcgplayerMarket == null && tcg != null) tcgplayerMarket = tcg;
        if (cardmarketAverageSell == null && cmkt != null) cardmarketAverageSell = cmkt;
        if (tcgplayerMarket != null && cardmarketAverageSell != null) break;
      }
    }
  }

  // Calculate total value (for "average value" box)
  const averageValue = getAverageCardValue({
    ...card,
    tcgplayerMarket,
    cardmarketAverageSell,
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/70">
      <div className={`
        inline-block align-bottom rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all
        sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full
        ${dark
          ? 'bg-dark-surface border border-dark-border'
          : 'bg-light-surface border border-light-border'
        }
        relative animate-fade-in
      `}>
        {/* Close Button (top right) */}
        <button
          type="button"
          onClick={onClose}
          className={`
            absolute top-5 right-5 z-10 rounded-full p-2 
            hover:bg-light-alt dark:hover:bg-dark-alt text-light-textMuted dark:text-dark-textMuted hover:text-light-primary dark:hover:text-dark-accent transition
            focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
          `}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-0 pt-7 pb-0 sm:p-0 sm:pb-4">
          <div className="flex flex-col md:flex-row gap-7">
            {/* Card Image */}
            <div className="relative w-full md:w-2/5 aspect-[2.5/3.5] flex items-center justify-center p-5">
              <div className={`
                relative w-full aspect-[2.5/3.5] rounded-xl shadow-lg
                ${dark ? 'bg-dark-background' : 'bg-light-background'}
                overflow-hidden mx-auto max-w-[340px] min-w-[220px]
              `}>
                {imageLoading && (
                  <div className={`
                    absolute inset-0 flex items-center justify-center
                    ${dark ? 'bg-dark-surface' : 'bg-light-alt'}
                  `}>
                    <div className="w-16 h-16 animate-pulse bg-light-border dark:bg-dark-border rounded-lg"/>
                  </div>
                )}
                <Image
                  src={imgSrc}
                  alt={card.tcgName || card.name || `Card #${card.id || card.cardId || ""}`}
                  fill
                  className="object-contain rounded-xl"
                  priority
                  onLoadingComplete={() => setImageLoading(false)}
                  onError={() => {
                    if (imgSrc !== FALLBACK_CARD_IMAGE) setImgSrc(FALLBACK_CARD_IMAGE);
                    setImageLoading(false);
                  }}
                  unoptimized
                />
              </div>
            </div>

            {/* Card Details */}
            <div className="w-full md:w-3/5 flex flex-col gap-0 py-7 pr-8 pl-8">
              <div>
                {/* Title, Number, Set, Rarity */}
                <div className="flex items-center gap-3 mb-1">
                  <h2 className={`text-2xl font-extrabold ${dark ? 'text-white' : 'text-light-primary'}`}>
                    {card.tcgName || card.name || `Card #${card.id || card.cardId || ""}`}
                  </h2>
                  {card.number && (
                    <span className={`
                      text-xs px-2 py-1 rounded-full font-bold
                      ${dark
                        ? 'bg-dark-alt text-dark-textMuted'
                        : 'bg-light-alt text-light-textMuted'
                      }
                    `}>
                      #{card.number}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
                  <span className={dark ? 'text-dark-textMuted font-semibold' : 'text-light-textMuted font-semibold'}>
                    {card.tcgSetName || card.setName || "Unknown Set"}
                  </span>
                  {(card.tcgRarity || card.rarity) && (
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full font-semibold
                      ${dark
                        ? 'bg-dark-primary text-dark-accentLight'
                        : 'bg-light-accent text-white'
                      }
                    `}>
                      {card.tcgRarity || card.rarity}
                    </span>
                  )}
                  {(card.tcgEdition || card.edition) && (
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${dark
                        ? 'bg-dark-border text-dark-accentLight'
                        : 'bg-light-border text-light-accent'
                      }
                    `}>
                      {card.tcgEdition || card.edition}
                    </span>
                  )}
                </div>
                {/* If only 1 variation, show badge */}
                {variationKeys.length === 1 && (
                  <div className="mb-2">
                    <span className={`
                      inline-block text-xs px-3 py-1 rounded font-bold uppercase tracking-wide
                      ${dark ? 'bg-dark-border text-dark-accent' : 'bg-light-alt text-light-primary'}
                    `}>
                      {formatVariation(mainVariation)}
                    </span>
                  </div>
                )}
                {/* Divider */}
                <div className="border-b border-light-border dark:border-dark-border my-3"/>
                {/* Card Stats */}
                <div className="flex flex-wrap items-center gap-7 mb-2">
                  <div>
                    <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} mb-0.5 font-medium`}>Quantity</span>
                    <span className={`font-bold text-lg ${dark ? 'text-white' : 'text-light-primary'}`}>{card.quantity || 0}</span>
                  </div>
                  <div>
                    <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} mb-0.5 font-medium`}>Condition</span>
                    <span className={`font-bold ${getConditionClass(card.condition)} ${dark ? 'text-white' : 'text-light-primary'}`}>
                      {formatCondition(card.condition) || "Not specified"}
                    </span>
                  </div>
                </div>
                {/* Added / Updated */}
                <div className="flex flex-wrap items-center gap-5 mb-4">
                  {(card.createdAt || card.dateAdded) && (
                    <div>
                      <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} mb-0.5 font-medium`}>Added</span>
                      <span className={dark ? 'text-white' : 'text-light-primary'}>
                        {formatDate(card.createdAt || card.dateAdded)}
                      </span>
                      <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'}`}>
                        {formatRelativeTime(card.createdAt || card.dateAdded)}
                      </span>
                    </div>
                  )}
                  {card.updatedAt && card.updatedAt !== card.createdAt && (
                    <div>
                      <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} mb-0.5 font-medium`}>Last Updated</span>
                      <span className={dark ? 'text-white' : 'text-light-primary'}>
                        {formatDate(card.updatedAt)}
                      </span>
                      <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'}`}>
                        {formatRelativeTime(card.updatedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- Pricing Info (main area) --- */}
              <div className="mb-3">
                {variationKeys.length === 1 ? (
                  <div className={`
                    rounded-xl p-4 mb-4 flex flex-wrap gap-8 items-center justify-start
                    ${dark ? 'bg-dark-background' : 'bg-light-background'}
                  `}>
                    <div>
                      <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} font-medium`}>
                        TCGplayer Market <span className="opacity-70">({formatVariation(mainVariation)})</span>
                      </span>
                      <span className="block text-lg text-green-500 font-bold">
                        {tcgplayerMarket !== null && tcgplayerMarket !== undefined
                          ? `£${Number(tcgplayerMarket).toFixed(2)}`
                          : <span className={dark ? 'text-dark-textMuted' : 'text-light-textMuted'}>N/A</span>}
                      </span>
                    </div>
                    <div>
                      <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} font-medium`}>
                        Cardmarket Avg <span className="opacity-70">({formatVariation(mainVariation)})</span>
                      </span>
                      <span className="block text-lg text-green-500 font-bold">
                        {cardmarketAverageSell !== null && cardmarketAverageSell !== undefined
                          ? `£${Number(cardmarketAverageSell).toFixed(2)}`
                          : <span className={dark ? 'text-dark-textMuted' : 'text-light-textMuted'}>N/A</span>}
                      </span>
                    </div>
                    {averageValue !== null && (
                      <div className="relative group inline-block">
                        <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} font-medium flex items-center gap-1`}>
                          Average Value ({card.quantity} cards)
                          {/* Info icon */}
                          <button
                            type="button"
                            aria-label="Show calculation info"
                            tabIndex={0}
                            className={`
                              ml-1 text-light-accent dark:text-dark-accentLight hover:text-light-primary dark:hover:text-dark-accent p-0 bg-transparent border-0 focus:outline-none
                            `}
                          >
                            <svg width="15" height="15" fill="none" viewBox="0 0 20 20">
                              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
                              <text x="10" y="15" textAnchor="middle" fontSize="12" fill="currentColor" fontWeight="bold">i</text>
                            </svg>
                          </button>
                          {/* Tooltip */}
                          <div
                            className={`
                              absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 min-w-[220px] max-w-xs
                              ${dark
                                ? 'bg-dark-surface text-dark-text border-dark-border'
                                : 'bg-white text-light-text border-light-border'
                              }
                              px-3 py-2 rounded shadow-lg text-xs border
                              opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
                              pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto
                              transition-opacity duration-200
                            `}
                          >
                            <svg
                              className="absolute left-1/2 -translate-x-1/2 -top-2"
                              width="20"
                              height="12"
                              viewBox="0 0 20 12"
                              fill="none"
                              aria-hidden="true"
                            >
                              <polygon
                                points="0,12 10,0 20,12"
                                className={dark ? 'fill-dark-surface' : 'fill-white'}
                              />
                            </svg>
                            The average value is calculated as:<br />
                            <span className="font-semibold">((TCGplayer Market + Cardmarket Avg) / 2) × quantity</span><br />
                            If only one market value is available, it uses that value.
                          </div>
                        </span>
                        <span className="block text-lg font-extrabold text-light-accent dark:text-dark-accent">
                          £{averageValue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className={`
                      rounded-xl p-4 mb-4 flex flex-wrap gap-8 items-center justify-start
                      ${dark ? 'bg-dark-background' : 'bg-light-background'}
                    `}>
                      <div>
                        <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} font-medium`}>TCGplayer Market</span>
                        <span className="block text-lg text-green-500 font-bold">
                          {tcgplayerMarket !== null && tcgplayerMarket !== undefined
                            ? `£${Number(tcgplayerMarket).toFixed(2)}`
                            : <span className={dark ? 'text-dark-textMuted' : 'text-light-textMuted'}>N/A</span>}
                        </span>
                      </div>
                      <div>
                        <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} font-medium`}>Cardmarket Avg</span>
                        <span className="block text-lg text-green-500 font-bold">
                          {cardmarketAverageSell !== null && cardmarketAverageSell !== undefined
                            ? `£${Number(cardmarketAverageSell).toFixed(2)}`
                            : <span className={dark ? 'text-dark-textMuted' : 'text-light-textMuted'}>N/A</span>}
                        </span>
                      </div>
                      {averageValue !== null && (
                        <div className="relative group inline-block">
                          <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} font-medium flex items-center gap-1`}>
                            Average Value ({card.quantity} cards)
                            <button
                              type="button"
                              aria-label="Show calculation info"
                              tabIndex={0}
                              className={`
                                ml-1 text-light-accent dark:text-dark-accentLight hover:text-light-primary dark:hover:text-dark-accent p-0 bg-transparent border-0 focus:outline-none
                              `}
                            >
                              <svg width="15" height="15" fill="none" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
                                <text x="10" y="15" textAnchor="middle" fontSize="12" fill="currentColor" fontWeight="bold">i</text>
                              </svg>
                            </button>
                            <div
                              className={`
                                absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 min-w-[220px] max-w-xs
                                ${dark
                                  ? 'bg-dark-surface text-dark-text border-dark-border'
                                  : 'bg-white text-light-text border-light-border'
                                }
                                px-3 py-2 rounded shadow-lg text-xs border
                                opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
                                pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto
                                transition-opacity duration-200
                              `}
                            >
                              <svg
                                className="absolute left-1/2 -translate-x-1/2 -top-2"
                                width="20"
                                height="12"
                                viewBox="0 0 20 12"
                                fill="none"
                                aria-hidden="true"
                              >
                                <polygon
                                  points="0,12 10,0 20,12"
                                  className={dark ? 'fill-dark-surface' : 'fill-white'}
                                />
                              </svg>
                              The average value is calculated as:<br />
                              <span className="font-semibold">((TCGplayer Market + Cardmarket Avg) / 2) × quantity</span><br />
                              If only one market value is available, it uses that value.
                            </div>
                          </span>
                          <span className="block text-lg font-extrabold text-light-accent dark:text-dark-accent">
                            £{averageValue.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* --- Pricing Table (only for multiple variations) --- */}
                    <div className="mt-2 mb-1">
                      <h3 className={`text-base font-bold mb-1 ${dark ? "text-white" : "text-light-primary"}`}>All Market Prices</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-[340px] text-sm border-collapse">
                          <thead>
                            <tr>
                              <th className="px-2 py-1 text-left">Variation</th>
                              <th className="px-2 py-1 text-left">TCGplayer</th>
                              <th className="px-2 py-1 text-left">Cardmarket</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variationKeys.map(variation => {
                              const { tcg, cmkt } = getDisplayPriceForVariation(variation);
                              return (
                                <tr key={variation}>
                                  <td className="px-2 py-1 font-semibold">{formatVariation(variation)}</td>
                                  <td className="px-2 py-1">
                                    {tcg !== null && tcg !== undefined
                                      ? `£${Number(tcg).toFixed(2)}`
                                      : <span className={dark ? 'text-dark-textMuted' : 'text-light-textMuted'}>N/A</span>}
                                  </td>
                                  <td className="px-2 py-1">
                                    {cmkt !== null && cmkt !== undefined
                                      ? `£${Number(cmkt).toFixed(2)}`
                                      : <span className={dark ? 'text-dark-textMuted' : 'text-light-textMuted'}>N/A</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {/* Notes section if present */}
                {card.notes && (
                  <div className={`
                    mt-3 rounded-lg p-3
                    ${dark ? 'bg-dark-surface border border-dark-border text-dark-text' : 'bg-light-surface border border-light-border text-light-text'}
                  `}>
                    <span className={`block text-xs ${dark ? 'text-dark-textMuted' : 'text-light-textMuted'} mb-0.5 font-bold`}>Notes</span>
                    <div className="whitespace-pre-line">{card.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Close Button at Bottom */}
        <div className={`
          ${dark ? 'bg-dark-background border-t border-dark-border' : 'bg-light-background border-t border-light-border'}
          px-6 py-4 flex justify-end
        `}>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center rounded-xl px-6 py-2 text-base font-semibold shadow 
              bg-light-primary hover:bg-light-accent dark:bg-dark-primary dark:hover:bg-dark-accent text-white transition focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
