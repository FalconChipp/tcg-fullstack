"use client";
import React from "react";

const steps = [
  {
    icon: "📝",
    title: "Sign Up",
    desc: "Create your free account in seconds.",
  },
  {
    icon: "📋",
    title: "Add Cards",
    desc: "Search and add your Pokémon cards to your digital collection.",
  },
  {
    icon: "📖",
    title: "Build Binders",
    desc: "Organise your cards into custom digital binders—just like in real life.",
  },
  {
    icon: "💡",
    title: "Wishlist",
    desc: "Keep track of cards you want to find next with a personal wishlist.",
  },
];

export default function HowItWorks() {
  return (
    <section
      className="
        py-12 px-2 sm:px-4 
        bg-light-background dark:bg-dark-background
        transition-colors
      "
    >
      <h2 className="text-3xl font-bold text-center mb-10 text-light-text dark:text-dark-text drop-shadow">
        How It Works
      </h2>
      <div className="flex flex-col md:flex-row justify-center items-stretch gap-6 max-w-5xl mx-auto">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="
              flex-1 flex flex-col items-center 
              bg-light-surface dark:bg-dark-surface
              rounded-2xl p-7
              shadow-lg transition-transform hover:-translate-y-1 hover:shadow-2xl
              border border-light-border dark:border-dark-border
              min-w-[220px]
            "
          >
            <div className="text-4xl md:text-5xl mb-3">{step.icon}</div>
            {/* Use brand accent blue for step titles */}
            <div className="font-semibold text-lg md:text-xl text-light-accent dark:text-dark-accent mb-2 text-center">
              {step.title}
            </div>
            {/* Use readable neutral text for descriptions */}
            <div className="text-light-textSecondary dark:text-dark-textSecondary text-base text-center">
              {step.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
