import { useState, useEffect, useRef } from 'react';

/**
 * QuantitySelectorModal
 * A modal for selecting how many cards to remove, styled to match site palette.
 * Props:
 *   - isOpen: boolean (modal visible)
 *   - onClose: function (close modal)
 *   - maxQuantity: number (max that can be removed)
 *   - onConfirm: function (quantity) (confirm callback)
 *   - cardName: string (display name)
 */
export default function QuantitySelectorModal({
  isOpen,
  onClose,
  maxQuantity,
  onConfirm,
  cardName,
}) {
  const [quantity, setQuantity] = useState(1);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      // Focus the input when modal opens
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const input = modalRef.current.querySelector('input');
          if (input) input.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (quantity > 0 && quantity <= maxQuantity) {
      onConfirm(quantity);
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className={`
          bg-light-surface dark:bg-dark-surface
          rounded-2xl p-6 w-full max-w-md shadow-2xl border border-light-border dark:border-dark-border
          animate-in slide-in-from-top-4 fade-in
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-light-error dark:text-dark-error mb-4">
          Remove {cardName || 'card'}
        </h3>

        <div className="mb-6">
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-light-textSecondary dark:text-dark-textSecondary mb-2"
          >
            Quantity (max: {maxQuantity})
          </label>
          <div className="mt-1 flex rounded-xl shadow-sm border border-light-border dark:border-dark-border overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
              className={`
                px-4 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text
                border-r border-light-border dark:border-dark-border
                hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                transition
              `}
            >
              -
            </button>
            <input
              type="number"
              id="quantity"
              min="1"
              max={maxQuantity}
              value={quantity}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10) || 1;
                setQuantity(Math.min(Math.max(1, value), maxQuantity));
              }}
              onKeyDown={handleKeyDown}
              className={`
                flex-1 w-full px-3 py-2 text-center bg-light-surface dark:bg-dark-surface
                text-light-text dark:text-dark-text border-0 focus:ring-2
                focus:ring-light-accent dark:focus:ring-dark-accent outline-none
                text-base font-semibold
              `}
            />
            <button
              type="button"
              onClick={() => setQuantity((prev) => Math.min(maxQuantity, prev + 1))}
              className={`
                px-4 py-2 bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text
                border-l border-light-border dark:border-dark-border
                hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                transition
              `}
            >
              +
            </button>
          </div>
          <p className="mt-1 text-sm text-light-textMuted dark:text-dark-textMuted">
            {quantity} of {maxQuantity} will be removed
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`
              px-4 py-2 text-sm font-medium text-light-text dark:text-dark-text
              bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border
              rounded-xl shadow-sm hover:bg-light-surface dark:hover:bg-dark-surface
              focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
              transition
            `}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`
              px-4 py-2 text-sm font-medium text-white bg-light-error dark:bg-dark-error
              rounded-xl shadow-sm border-none hover:bg-red-700 dark:hover:bg-red-800
              focus:outline-none focus:ring-2 focus:ring-light-error dark:focus:ring-dark-error
              transition
            `}
          >
            Remove {quantity} {quantity > 1 ? 'cards' : 'card'}
          </button>
        </div>
      </div>
    </div>
  );
}
