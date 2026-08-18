"use client";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { useMemo } from "react";

export default function NotFound() {
  const errorMessages = [
    "Looks like this page has the same pull rates as Destined Rivals. Let's get you back to your collection!",
    "This page must be hiding in the Lost Zone. Let's return to your binder!",
    "Whoops! This page is in the discard pile. Let's get you back to your deck!",
    "You played 'search page', but this one's not in your collection!",
    "Like a rare holo, this page is nowhere to be found. Try searching again!",
    "Looks like this page just got shuffled into the prize cards!",
    "You need a Master Ball to find this page. Maybe head back to your collection instead?",
    "Looks like you've drawn a blank! No page here—better luck on your next turn.",
    "This page must be stuck in the Lost Origin set. Let's get you back to your cards!",
    "The page you're looking for has fainted! Let's get you to a Center… or the homepage.",
    "404 energy: This page isn't in your decklist.",
    "You flipped a coin and got tails—this page didn't load.",
    "Looks like you prized this page. Maybe try a different route?",
    "You activated an Ability, but this page is still benched.",
    "Sorry, this page has fainted. Let's return to your active area!",
    "This page is hiding like a Shiny—super rare and hard to find.",
    "You've reached a dead end—time to use Escape Rope and go home!",
    "This page is more elusive than a Gold Star.",
    "Your search has no effect! Try heading back to your collection.",
    "Looks like you just hit a dead draw. Better head back to the homepage!",
    "This page used 'Disappear'! Let's get you back to the main site.",
    "Whoopsie",
    "This page is as hard to find as a Base Set Charizard.",
    "Looks like this page is hiding in Hidden Fates.",
    "This page is more elusive than a Shining Legends Secret Rare.",
    "Like a Lost Origin Giratina, this page has vanished into the Lost Zone.",
    "No luck—this page is rarer than an Evolving Skies Moonbreon.",
    "You've pulled a Fusion Strike—no hits this time!",
    "This page must have been shuffled into your Celebrations Classic Collection.",
    "Looks like this page has rotated out—try Standard instead!",
    "This page is as missing as half the cards in Crimson Invasion.",
    "Like a shiny Charizard from Champion's Path, this page just won't appear.",
    "You searched Silver Tempest, but all you found was Lugia's shadow.",
    "This page is in the Ancient Origins—somewhere in the past!",
    "You reached for Crown Zenith, but the page isn't part of the Galar Gallery.",
    "This page is rarer than a Gold Mew in Shining Legends.",
    "This page is as lost as a Reverse Holo from EX Dragon Frontiers.",
    "Like a secret rare in Obsidian Flames, this page dodges every search.",
    "This page is hiding with the Shinies in Paldean Fates.",
    "This page took a trip to Paldea Evolved and hasn't come back.",
    "Like an error card in XY Evolutions, this page slipped through the cracks.",
    "This page got sent to Scarlet & Violet, but it missed the rotation.",
    "You opened a pack of Astral Radiance—just bulk, no page here.",
    "Like a Vintage promo, this page is just not in the packs anymore.",
    "You're looking for Vivid Voltage—this page is just a Pikachu VMAX dream.",
    "This page is as missing as a Gold Star in EX Deoxys.",
    "Whoopsie! This page pulled a 'Greedent'—all filler, no hits.",
    "You opened a booster… but it's all energy cards!",
    "Like my ETB pulls—just disappointment.",
    "This page was supposed to be a God Pack. Guess not.",
    "Yikes! Looks like you pulled a dud pack.",
    "This page is more elusive than pulling an Alt-Art.",
    "No hits—this page is just a green code card.",
    "This page got stuck in a resealed pack.",
    "Looks like this page got lost in shuffle time.",
    "You tried to search, but hit the damage counter instead.",
    "This page is rarer than a first pack holo.",
    "Out of print! This page left with Wizards of the Coast.",
    "More cursed than a miscut Base Set Pikachu.",
    "Like my last ten packs—nothing but bulk.",
    "Someone opened this page and found only Trainer cards.",
    "This page used Escape Rope. It's gone!",
    "Whoops! You hit the 'Professor's Research'—discard and draw again.",
    "You just whiffed your pull.",
    "Ultra Rare? More like Ultra Gone.",
    "Try again—maybe your luck will change!",
  ];
  const message = useMemo(
    () => errorMessages[Math.floor(Math.random() * errorMessages.length)],
    []
  );
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-background text-dark-text transition-colors px-4">
      <h1 className="font-heading text-[5rem] sm:text-[7rem] font-extrabold tracking-tight text-dark-accent drop-shadow-lg mb-2 select-none">
        404
      </h1>
      <h2 className="font-heading text-3xl sm:text-4xl font-extrabold mb-4 text-dark-primary tracking-tight drop-shadow text-center">
        Page Not Found!
      </h2>
      <div className="text-lg text-dark-textSecondary mb-10 text-center max-w-xl">
        {message}
      </div>
      <Link
        href="/"
        className="
          group inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl
          bg-dark-accent text-white transition-all duration-200
          hover:bg-dark-primary hover:text-dark-background
          focus:outline-none focus:ring-2 focus:ring-dark-accent scale-100 hover:scale-105
        "
        style={{ boxShadow: '0 4px 24px 0 rgba(19,131,146,0.20), 0 1.5px 7px 0 rgba(0,0,0,0.08)' }}
      >
        <FaArrowLeft className="mr-2 opacity-80 group-hover:opacity-100 transition" />
        <span className="tracking-wide font-bold">Go Home</span>
      </Link>
    </div>
  );
}
