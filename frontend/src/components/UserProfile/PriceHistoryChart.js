"use client";

import React, { useMemo } from "react";

function formatAxisLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(d);
}

function safeNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lightweight SVG sparkline tailored for price history.
 * Avoids pulling in extra chart libs for a single modal use.
 */
export default function PriceHistoryChart({
  data = [],
  height = 160,
  dark = false,
}) {
  const view = useMemo(() => {
    const points = (Array.isArray(data) ? data : [])
      .map((d) => ({
        date: d.date,
        value: safeNumber(d.market ?? d.mid ?? d.high ?? d.low),
      }))
      .filter((p) => p.value != null);

    if (points.length === 0) {
      return { points: [], path: "", min: null, max: null };
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const coords = points.map((p, idx) => {
      const x = points.length === 1 ? 0 : (idx / (points.length - 1)) * 100;
      const y = 100 - ((p.value - min) / span) * 100;
      return { ...p, x, y: Number.isFinite(y) ? y : 50 };
    });

    const path = coords
      .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");

    return { points: coords, path, min, max };
  }, [data]);

  if (!view.points.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-sm text-light-textMuted dark:text-dark-textMuted">
        <span>No price history yet</span>
      </div>
    );
  }

  const first = view.points[0];
  const last = view.points[view.points.length - 1];

  return (
    <div className="space-y-2">
      <svg
        role="img"
        aria-label="Price history chart"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full rounded-xl"
        style={{ height }}
      >
        <defs>
          <linearGradient id="price-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dark ? "#38bdf8" : "#2563eb"} stopOpacity="0.35" />
            <stop offset="100%" stopColor={dark ? "#38bdf8" : "#2563eb"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${view.path} L100 100 L0 100 Z`}
          fill="url(#price-gradient)"
          opacity="0.35"
        />
        <path
          d={view.path}
          fill="none"
          stroke={dark ? "#38bdf8" : "#2563eb"}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <div className="flex items-center justify-between text-xs text-light-textMuted dark:text-dark-textMuted">
        <span>{formatAxisLabel(first?.date)}</span>
        <span>{formatAxisLabel(last?.date)}</span>
      </div>
    </div>
  );
}
