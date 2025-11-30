// /components/marketplace/SellCardModal.js
"use client";
import React, { useState } from "react";
import Image from "next/image";
import { FaTimes, FaCheckCircle, FaUpload } from "react-icons/fa";

// --- Mocked User Collection (Replace with prop/API later) ---
const mockCollection = [
  {
    id: "c1",
    name: "Charizard GX",
    image: "/cards/charizard-gx.png",
    setName: "Hidden Fates",
    cardNumber: "SV49",
    rarity: "Secret Rare",
    quantity: 2,
    language: "English",
    condition: "Near Mint",
  },
  {
    id: "c2",
    name: "Pikachu VMAX",
    image: "/cards/pikachu-vmax.png",
    setName: "Vivid Voltage",
    cardNumber: "044/185",
    rarity: "Ultra Rare",
    quantity: 1,
    language: "English",
    condition: "Lightly Played",
  },
  {
    id: "c3",
    name: "Rayquaza VMAX",
    image: "/cards/rayquaza-vmax.png",
    setName: "Evolving Skies",
    cardNumber: "218/203",
    rarity: "Secret Rare",
    quantity: 3,
    language: "Japanese",
    condition: "Near Mint",
  },
];

// -- Supported options (extend as needed) --
const conditionOptions = [
  "Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"
];
const languageOptions = [
  "English", "Japanese", "French", "German", "Italian", "Spanish", "Portuguese"
];

export default function SellCardModal({ open, onClose, onSell }) {
  const [step, setStep] = useState(1); // 1: Pick, 2: Form
  const [selectedCard, setSelectedCard] = useState(null);
  const [form, setForm] = useState({
    condition: "",
    language: "",
    price: "",
    proofImage: null,
  });
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  // --- Step 1: Pick card from collection ---
  function handleSelectCard(card) {
    setSelectedCard(card);
    setForm({
      ...form,
      condition: card.condition || "",
      language: card.language || "English",
    });
    setStep(2);
  }

  // --- Step 2: Fill out form and submit ---
  function handleChange(e) {
    const { name, value, files } = e.target;
    if (name === "proofImage") {
      setForm({ ...form, proofImage: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Here you'd send data to backend
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSelectedCard(null);
      setForm({ condition: "", language: "", price: "", proofImage: null });
      setStep(1);
      onSell && onSell();
      onClose();
    }, 1500);
  }

  function handleBack() {
    setSelectedCard(null);
    setStep(1);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-xl max-w-2xl w-full border border-light-border dark:border-dark-border p-6 relative">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-xl text-light-textMuted dark:text-dark-textMuted hover:text-light-error dark:hover:text-dark-error"
          onClick={onClose}
        >
          <FaTimes />
        </button>
        {success ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FaCheckCircle className="text-5xl text-light-success dark:text-dark-success mb-4" />
            <div className="text-xl font-bold mb-2">Card listed successfully!</div>
            <div className="text-light-textSecondary dark:text-dark-textSecondary">It’s now live on the marketplace.</div>
          </div>
        ) : step === 1 ? (
          <>
            <h2 className="text-2xl font-bold mb-3 text-center">Sell a Card from Your Collection</h2>
            <div className="mb-2 text-light-textSecondary dark:text-dark-textSecondary text-center">
              Pick a card you own to list it for sale.
            </div>
            <div className="max-h-80 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-1">
              {mockCollection.map(card => (
                <button
                  key={card.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent transition shadow group"
                  onClick={() => handleSelectCard(card)}
                >
                  <div className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-light-surface dark:bg-dark-surface border">
                    <Image src={card.image} alt={card.name} fill className="object-contain" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-base text-light-primary dark:text-dark-primary">{card.name}</div>
                    <div className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      {card.setName} &bull; #{card.cardNumber}
                    </div>
                    <div className="text-xs text-light-textMuted dark:text-dark-textMuted">
                      Owned: <b>{card.quantity}</b>
                    </div>
                  </div>
                  <span className="ml-2 text-xs px-2 py-1 bg-light-surface dark:bg-dark-surface rounded font-semibold">{card.rarity}</span>
                </button>
              ))}
            </div>
            {!mockCollection.length && (
              <div className="mt-6 text-center text-light-textMuted dark:text-dark-textMuted">You have no cards in your collection.</div>
            )}
          </>
        ) : (
          // Step 2: Form
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <button
              type="button"
              className="absolute left-4 top-4 text-light-textMuted dark:text-dark-textMuted hover:text-light-accent dark:hover:text-dark-accent"
              onClick={handleBack}
              tabIndex={-1}
            >
              &larr; Back
            </button>
            <div className="flex items-center gap-4">
              <Image src={selectedCard.image} alt={selectedCard.name} width={60} height={90} className="rounded-md border" />
              <div>
                <div className="font-bold text-lg">{selectedCard.name}</div>
                <div className="text-xs text-light-textMuted dark:text-dark-textMuted">
                  {selectedCard.setName} &bull; #{selectedCard.cardNumber}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-semibold text-sm">Condition</label>
                <select
                  name="condition"
                  className="w-full rounded-lg p-2 bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border"
                  value={form.condition}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select condition</option>
                  {conditionOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-sm">Language</label>
                <select
                  name="language"
                  className="w-full rounded-lg p-2 bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border"
                  value={form.language}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select language</option>
                  {languageOptions.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block mb-1 font-semibold text-sm">Price (£)</label>
              <input
                name="price"
                type="number"
                min={0.01}
                step={0.01}
                value={form.price}
                onChange={handleChange}
                className="w-full rounded-lg p-2 bg-light-alt dark:bg-dark-alt border border-light-border dark:border-dark-border"
                placeholder="Enter price"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-sm">Proof of Ownership (optional)</label>
              <input
                name="proofImage"
                type="file"
                accept="image/*"
                onChange={handleChange}
                className="w-full"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 mt-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white dark:text-dark-surface font-bold text-lg shadow hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
            >
              List Card for Sale
            </button>
          </form>
        )}
      </div>
    </div>
  );
}