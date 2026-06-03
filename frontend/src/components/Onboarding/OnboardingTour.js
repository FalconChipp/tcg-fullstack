"use client";

import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useRouter } from "next/router";
import { AuthContext } from "@/components/Auth/AuthProvider";

const PADDING = 8;

const steps = [
  {
    target: "#dashboard-welcome",
    title: "Welcome to SixByFive TCG",
    content: "You've landed on your collection dashboard. This is your home base.",
  },
  {
    target: "#dashboard-summary",
    title: "Your collection at a glance",
    content: "Collection stats, total value, and progress are all tracked here automatically.",
  },
  {
    target: "#card-search-form",
    title: "Find any card",
    content: "Search by name, set, rarity, or number — then add it to your collection or wishlist in one click.",
  },
  {
    target: "#binder-create-btn",
    title: "Build binders",
    content: "Create digital binders for sets, themes, or anything you're working towards.",
  },
  {
    target: "#wishlist-tab",
    title: "Track what you want",
    content: "Add chase cards to your wishlist so your next collecting goals are always visible.",
  },
  {
    target: "#profile-link",
    title: "Your public profile",
    content: "Share your collection and binders with other collectors via your profile link.",
  },
  {
    target: "#subscriptions-link",
    title: "Upgrade your plan",
    content: "Unlock unlimited binders, reduced marketplace fees, and early access to new features.",
  },
  {
    target: null,
    title: "You're all set",
    content: "That's the tour. You can replay it any time from the Help menu. Happy collecting.",
  },
];

const OnboardingTour = forwardRef((props, ref) => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);

  const isDashboard = router.pathname === "/dashboard";

  useImperativeHandle(ref, () => ({
    startTour: () => {
      if (!isDashboard) {
        router.push("/dashboard?tour=1");
      } else {
        setStep(0);
        setActive(true);
      }
    },
  }));

  // Auto-start on dashboard — first login OR ?tour=1 param
  useEffect(() => {
    if (!user || !isDashboard) return;
    const forceTour = router.query.tour === "1";
    const key = `onboarding_${user.id}`;
    const isFirstTime = typeof window !== "undefined" && !localStorage.getItem(key);
    if (forceTour || isFirstTime) {
      // Clean the URL param without triggering a re-render
      if (forceTour) {
        router.replace("/dashboard", undefined, { shallow: true });
      }
      setTimeout(() => { setStep(0); setActive(true); }, 600);
    }
  }, [user, isDashboard, router.query.tour]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureTarget = useCallback(() => {
    const target = steps[step]?.target;
    if (!active || !target) { setRect(null); return; }
    const el = document.querySelector(target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step, active]);

  // Scroll target into view then measure
  useEffect(() => {
    if (!active) return;
    const target = steps[step]?.target;
    if (!target) { setRect(null); return; }
    const el = document.querySelector(target);
    if (!el) { setRect(null); return; }

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Measure after scroll settles, then keep in sync
    const t = setTimeout(() => {
      measureTarget();
      // Continuous sync via rAF during any residual scroll
      let frames = 0;
      const loop = () => {
        measureTarget();
        frames++;
        if (frames < 30) rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    }, 400);

    return () => {
      clearTimeout(t);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [step, active, measureTarget]);

  // Keep spotlight in sync on resize/scroll
  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measureTarget, { passive: true });
    window.addEventListener("scroll", measureTarget, { passive: true });
    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget);
    };
  }, [active, measureTarget]);

  const finish = useCallback(() => {
    if (user && typeof window !== "undefined") {
      localStorage.setItem(`onboarding_${user.id}`, "done");
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setActive(false);
    setRect(null);
  }, [user]);

  const goNext = useCallback(() => {
    if (step === steps.length - 1) finish();
    else setStep((s) => s + 1);
  }, [step, finish]);

  const goBack = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  if (!active) return null;

  const hasTarget = !!rect;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const tooltipW = Math.min(320, vw - 24);

  // Spotlight bounds (with padding)
  const sl = hasTarget ? {
    t: rect.top - PADDING,
    l: rect.left - PADDING,
    w: rect.width + PADDING * 2,
    h: rect.height + PADDING * 2,
  } : null;

  // Tooltip position
  let tooltipStyle = {};
  if (hasTarget && sl) {
    const spaceBelow = vh - (sl.t + sl.h);
    const showBelow = spaceBelow >= 180 || spaceBelow >= sl.t;
    let tl = sl.l + sl.w / 2 - tooltipW / 2;
    tl = Math.max(12, Math.min(tl, vw - tooltipW - 12));
    tooltipStyle = showBelow
      ? { top: sl.t + sl.h + 12, left: tl, width: tooltipW }
      : { top: Math.max(12, sl.t - 12 - 200), left: tl, width: tooltipW };
  } else {
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: tooltipW,
    };
  }

  return (
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true">
      {/* Overlay */}
      {hasTarget && sl ? (
        <>
          <div className="absolute bg-black/60" style={{ top: 0, left: 0, right: 0, height: Math.max(0, sl.t) }} />
          <div className="absolute bg-black/60" style={{ top: sl.t + sl.h, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-black/60" style={{ top: sl.t, left: 0, width: Math.max(0, sl.l), height: sl.h }} />
          <div className="absolute bg-black/60" style={{ top: sl.t, left: sl.l + sl.w, right: 0, height: sl.h }} />
          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: sl.t, left: sl.l, width: sl.w, height: sl.h,
              boxShadow: "0 0 0 2px #6366f1, 0 0 0 4px rgba(99,102,241,0.2)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      {/* Tooltip */}
      <div className="absolute z-10 rounded-2xl border border-dark-border bg-dark-surface shadow-2xl shadow-black/50 p-5" style={tooltipStyle}>
        {/* Progress */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-5 bg-dark-accent" : i < step ? "w-1.5 bg-dark-accent/40" : "w-1.5 bg-dark-border"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-dark-textMuted tabular-nums">{step + 1} / {steps.length}</span>
        </div>

        <h3 className="text-sm font-black text-dark-strong mb-1.5">{steps[step].title}</h3>
        <p className="text-sm leading-6 text-dark-textMuted">{steps[step].content}</p>

        <div className="flex items-center justify-between mt-4">
          <button type="button" onClick={finish} className="text-xs text-dark-textMuted hover:text-dark-strong transition">
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl border border-dark-border bg-dark-alt px-3 py-2 text-xs font-bold text-dark-strong hover:border-dark-accent transition"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl bg-dark-accent px-4 py-2 text-xs font-black text-white hover:bg-dark-accentLight transition"
            >
              {step === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

OnboardingTour.displayName = "OnboardingTour";
export default OnboardingTour;
