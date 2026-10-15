import React, { useState } from 'react';
import CardImage from "@/components/Cards/CardImage";
import { formatVariation } from "@/utils/formatVariation";


export default function CardDetails({ card, onClose, onUpdateCard }) {
  const [full, setFull] = useState(false);

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4
        ${full ? 'overflow-auto' : 'overflow-hidden'}`}
    >
      <div className={`
        bg-light-surface dark:bg-dark-surface
        rounded-2xl shadow-xl relative flex flex-col
        border border-light-border dark:border-dark-border
        ${full ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-[90%] max-w-4xl max-h-[90vh]'}
      `}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl text-light-textMuted dark:text-dark-textMuted hover:text-light-error dark:hover:text-dark-error"
        >
          &times;
        </button>
        {/* Fullscreen Toggle */}
        <button
          onClick={() => setFull(!full)}
          className="absolute bottom-4 right-4 bg-light-text dark:bg-dark-text text-white px-3 py-1 rounded bg-opacity-70"
        >
          {full ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
        {/* Content */}
        <div className="flex flex-col md:flex-row gap-6 p-6 overflow-auto">
          {/* Image */}
          <div className="flex-1">
            <div className="relative aspect-[2/3] w-full">
              <CardImage
                src={card.image}
                name={card.name}
                cardId={card.cardId || card.id}
                className="absolute inset-0 w-full h-full object-contain rounded-xl"
              />
            </div>
          </div>
          {/* Card Info */}
          <div className="flex-1 space-y-4">
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">{card.name}</h2>
            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-light-alt dark:bg-dark-alt">
                <p className="text-sm text-light-textMuted dark:text-dark-textMuted">Set</p>
                <p className="text-light-text dark:text-dark-text">{card.setName}</p>
              </div>
              <div className="p-4 rounded-xl bg-light-alt dark:bg-dark-alt">
                <p className="text-sm text-light-textMuted dark:text-dark-textMuted">Rarity</p>
                <p className="text-light-text dark:text-dark-text">{card.rarity}</p>
              </div>
              <div className="p-4 rounded-xl bg-light-alt dark:bg-dark-alt">
                <p className="text-sm text-light-textMuted dark:text-dark-textMuted">Condition</p>
                <p className="text-light-text dark:text-dark-text">{card.condition || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-xl bg-light-alt dark:bg-dark-alt">
                <p className="text-sm text-light-textMuted dark:text-dark-textMuted">Quantity</p>
                <p className="text-light-text dark:text-dark-text">{card.quantity || 1}</p>
              </div>
            </div>
            {/* Market Prices */}
            <div className="p-4 rounded-xl bg-light-alt dark:bg-dark-alt">
              <h3 className="font-semibold mb-2 text-light-text dark:text-dark-text">Market Prices</h3>
              {card.tcgplayerLow && (
                <div className="flex justify-between">
                  <span className="text-light-textMuted dark:text-dark-textMuted">TCGplayer Low</span>
                  <span className="text-light-success dark:text-dark-success">${card.tcgplayerLow.toFixed(2)}</span>
                </div>
              )}
              {card.cardmarketAverageSell && (
                <div className="flex justify-between">
                  <span className="text-light-textMuted dark:text-dark-textMuted">Cardmarket Avg</span>
                  <span className="text-light-success dark:text-dark-success">€{card.cardmarketAverageSell.toFixed(2)}</span>
                </div>
              )}
              {!card.tcgplayerLow && !card.cardmarketAverageSell && (
                <div className="text-light-textMuted dark:text-dark-textMuted">No pricing data available</div>
              )}
            </div>
            {/* Variation */}
            {card.variation && (
              <div className="mb-2">
                <span className="text-sm font-medium text-light-textMuted dark:text-dark-textMuted">
                  Variation:{" "}
                </span>
                <span className="text-sm text-light-text dark:text-dark-text">
                  {formatVariation(card.variation)}
                </span>
              </div>
            )}
            {/* Not owned warning */}
            {!card.owned && (
              <div className="bg-light-error/20 dark:bg-dark-error/20 text-light-error dark:text-dark-error p-3 rounded text-center">
                Not in Collection
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
