"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * Generate a stable set of snowflake configs.
 */
function useSnowflakes(count = 70) {
  return useMemo(() => {
    const flakes = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        id: i,
        x: Math.random() * 100,           // horizontal start (vw%)
        drift: -20 + Math.random() * 40,  // horizontal drift
        duration: 12 + Math.random() * 12,
        delay: Math.random() * 10,
        size: 2 + Math.random() * 4,
        opacity: 0.4 + Math.random() * 0.4,
      });
    }
    return flakes;
  }, [count]);
}

/**
 * SnowBackground
 *  - Snow layer is ABOVE the site content (high z-index)
 *  - pointer-events-none so it doesn't block any interaction
 */
export default function SnowBackground({ children, enabled = true }) {
  const flakes = useSnowflakes(70);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen">
      {/* ❄ Snow overlay ON TOP of everything else */}
      <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
        {flakes.map((flake) => (
          <motion.span
            key={flake.id}
            className="absolute rounded-full bg-white"
            style={{
              top: "-5vh",
              left: `${flake.x}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              opacity: flake.opacity,
              boxShadow: "0 0 6px rgba(255,255,255,0.8)",
            }}
            initial={{
              y: "-5vh",
            }}
            animate={{
              y: "110vh",
              x: [`${flake.x}%`, `${flake.x + flake.drift}%`],
            }}
            transition={{
              duration: flake.duration,
              delay: flake.delay,
              repeat: Infinity,
              repeatType: "loop",
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Content below snow (lower z-index) */}
      <div className="relative z-[10]">{children}</div>
    </div>
  );
}
