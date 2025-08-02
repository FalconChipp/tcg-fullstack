"use client";

import React, {
  useContext,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle
} from "react";
import { AuthContext } from "@/components/Auth/AuthProvider";

// --- Steps for the onboarding tour ---
const steps = [
  {
    target: "#dashboard-welcome",
    content: "Welcome to SixByFive TCG! You’ve landed on your collection dashboard.",
  },
  {
    target: "#dashboard-summary",
    content: "Here you’ll see collection stats and progress at a glance.",
  },
  {
    target: "#card-search-form",
    content: "Search cards by name, set, rarity or number—then add them.",
  },
  {
    target: "#binder-create-btn",
    content: "Create digital binders and start organising your collection.",
  },
  {
    target: "#wishlist-tab",
    content: "Keep track of cards you want with your personal wishlist.",
  },
  {
    target: "#profile-link",
    content: "View your public profile to show off your cards and binders.",
  },
  // {
  //   target: "#roadmap-link",
  //   content: "Check the roadmap to see trading, marketplace, and achievements coming soon.",
  // },
  {
    target: "#subscriptions-link",
    content: "Upgrade to unlock premium tools like unlimited binders and early access.",
  },
  {
    target: "#about-discord-link",
    content: "Join our Discord or contact us to suggest features or get help.",
  },
  {
    target: "body",
    content: "That’s it—you're ready to start. Revisit this tour from Help anytime!",
  },
];

// --- OnboardingTour component ---
// Now forwards a ref so parent can trigger the tour manually (redo link)
const OnboardingTour = forwardRef((props, ref) => {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);

  // Allow parent to start the tour by calling .startTour()
  useImperativeHandle(ref, () => ({
    startTour: () => {
      setStep(0);       // Restart at the beginning
      setActive(true);  // Show tour
    }
  }));

  // Auto-show on first login, only once per user
  useEffect(() => {
    if (!user) return;
    const key = `onboarding_${user.id}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      setActive(true);
    }
  }, [user]);

  // Highlight the element for the current step
  useEffect(() => {
    if (!active) return;
    const all = document.querySelectorAll(".onboarding-highlight");
    all.forEach((el) => el.classList.remove("onboarding-highlight"));
    const current = document.querySelector(steps[step].target);
    if (current) {
      current.classList.add("onboarding-highlight");
      current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Clean up highlights when step/active changes or unmounts
    return () => {
      const allCleanup = document.querySelectorAll(".onboarding-highlight");
      allCleanup.forEach((el) => el.classList.remove("onboarding-highlight"));
    };
  }, [step, active]);

  // End the tour: mark complete, clear highlight, hide modal
  const finish = () => {
    if (user && typeof window !== "undefined") {
      localStorage.setItem(`onboarding_${user.id}`, "done");
    }
    const all = document.querySelectorAll(".onboarding-highlight");
    all.forEach((el) => el.classList.remove("onboarding-highlight"));
    setActive(false);
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[2000] flex items-center justify-center p-4">
      <div className="bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text rounded-xl p-6 max-w-sm w-full">
        <p className="mb-6 text-center">{steps[step].content}</p>
        <div className="flex justify-between">
          <button
            onClick={finish}
            className="px-4 py-2 rounded-lg bg-light-border dark:bg-dark-border"
          >
            Skip
          </button>
          <button
            onClick={() =>
              step === steps.length - 1 ? finish() : setStep((s) => s + 1)
            }
            className="px-4 py-2 rounded-lg bg-light-accent dark:bg-dark-accent text-white dark:text-black"
          >
            {step === steps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
});

export default OnboardingTour;
