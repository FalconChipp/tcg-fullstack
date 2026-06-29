"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";

const GBP = "£";

function fmt(n) {
  if (n == null) return "—";
  return `${GBP}${Number(n).toFixed(2)}`;
}

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

function pickValue(d) {
  return safeNumber(d.market ?? d.mid ?? d.high ?? d.low);
}

// Smooth the path using cubic bezier control points
function smoothPath(coords) {
  if (coords.length < 2) return coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

  let d = `M${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = ((prev.x + curr.x) / 2).toFixed(2);
    d += ` C${cpx} ${prev.y.toFixed(2)}, ${cpx} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }
  return d;
}

export default function PriceHistoryChart({ data = [], height = 180, dark = false }) {
  const svgRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const view = useMemo(() => {
    const points = (Array.isArray(data) ? data : [])
      .map((d) => ({ date: d.date, value: pickValue(d) }))
      .filter((p) => p.value != null);

    if (points.length === 0) return { points: [], path: "", areaPath: "", min: null, max: null };

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    // 8px top padding in the 100-unit viewBox so the line doesn't clip at top
    const PAD_TOP = 8;
    const PAD_BOT = 4;
    const usable = 100 - PAD_TOP - PAD_BOT;

    const coords = points.map((p, idx) => ({
      ...p,
      x: points.length === 1 ? 50 : (idx / (points.length - 1)) * 100,
      y: PAD_TOP + (1 - (p.value - min) / span) * usable,
    }));

    const linePath = smoothPath(coords);
    const first = coords[0];
    const last = coords[coords.length - 1];
    const areaPath = `${linePath} L${last.x.toFixed(2)} 100 L${first.x.toFixed(2)} 100 Z`;

    return { points: coords, path: linePath, areaPath, min, max };
  }, [data]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!svgRef.current || view.points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(xRatio * (view.points.length - 1));
      setHoveredIdx(Math.max(0, Math.min(view.points.length - 1, idx)));
    },
    [view.points.length]
  );

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  if (!view.points.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-sm text-vault-textTertiary">
        <span>No price history yet</span>
      </div>
    );
  }

  const hovered = hoveredIdx != null ? view.points[hoveredIdx] : null;
  const last = view.points[view.points.length - 1];
  const first = view.points[0];
  const trend = last.value > first.value ? "up" : last.value < first.value ? "down" : "flat";

  const accent = dark ? "#38bdf8" : "#2563eb";
  const accentUp = "#22c55e";
  const accentDown = "#ef4444";
  const lineColor = trend === "up" ? accentUp : trend === "down" ? accentDown : accent;
  const gradId = `pg-${dark ? "d" : "l"}`;

  // Y-axis grid lines at 0%, 50%, 100% of the value range
  const midValue = (view.min + view.max) / 2;

  return (
    <div className="space-y-1">
      {/* Hover tooltip / current price header */}
      <div className="flex items-baseline justify-between px-0.5 mb-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-bold tabular-nums ${dark ? "text-white" : "text-vault-accent"}`}>
            {hovered ? fmt(hovered.value) : fmt(last.value)}
          </span>
          {!hovered && (
            <span
              className={`text-xs font-semibold ${
                trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : dark ? "text-vault-textTertiary" : "text-vault-textTertiary"
              }`}
            >
              {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
            </span>
          )}
          {hovered && (
            <span className={`text-xs ${dark ? "text-vault-textTertiary" : "text-vault-textTertiary"}`}>
              {formatAxisLabel(hovered.date)}
            </span>
          )}
        </div>
        <div className={`text-xs ${dark ? "text-vault-textTertiary" : "text-vault-textTertiary"}`}>
          <span>
            {fmt(view.min)} – {fmt(view.max)}
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          role="img"
          aria-label="Price history chart"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full rounded-[10px]"
          style={{ height, cursor: "crosshair" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Subtle grid lines */}
          {[0, 50, 100].map((pct) => {
            const y = 8 + (pct / 100) * 88; // matches PAD_TOP=8, usable=88
            return (
              <line
                key={pct}
                x1="0" y1={y.toFixed(1)}
                x2="100" y2={y.toFixed(1)}
                stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
                strokeWidth="0.5"
              />
            );
          })}

          {/* Area fill */}
          <path d={view.areaPath} fill={`url(#${gradId})`} />

          {/* Line */}
          <path
            d={view.path}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Hover: vertical crosshair + dot */}
          {hovered && (
            <>
              <line
                x1={hovered.x.toFixed(2)} y1="0"
                x2={hovered.x.toFixed(2)} y2="100"
                stroke={lineColor}
                strokeWidth="0.6"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              <circle
                cx={hovered.x.toFixed(2)}
                cy={hovered.y.toFixed(2)}
                r="2"
                fill={lineColor}
                stroke={dark ? "#1e293b" : "#fff"}
                strokeWidth="0.8"
              />
            </>
          )}

          {/* End dot (latest price) */}
          {!hovered && (
            <circle
              cx={last.x.toFixed(2)}
              cy={last.y.toFixed(2)}
              r="2"
              fill={lineColor}
              stroke={dark ? "#1e293b" : "#fff"}
              strokeWidth="0.8"
            />
          )}
        </svg>

        {/* Y-axis labels (overlaid, left side) */}
        <div
          className="absolute inset-y-0 left-0 flex flex-col justify-between pointer-events-none pl-1"
          style={{ fontSize: 9 }}
        >
          <span className={dark ? "text-vault-textTertiary/60" : "text-vault-textTertiary/60"}>
            {fmt(view.max)}
          </span>
          <span className={dark ? "text-vault-textTertiary/60" : "text-vault-textTertiary/60"}>
            {fmt(midValue)}
          </span>
          <span className={dark ? "text-vault-textTertiary/60" : "text-vault-textTertiary/60"}>
            {fmt(view.min)}
          </span>
        </div>
      </div>

      {/* X-axis date labels */}
      <div className={`flex items-center justify-between text-[10px] px-0.5 ${dark ? "text-vault-textTertiary/70" : "text-vault-textTertiary/70"}`}>
        <span>{formatAxisLabel(first?.date)}</span>
        {view.points.length > 2 && (
          <span>{formatAxisLabel(view.points[Math.floor(view.points.length / 2)]?.date)}</span>
        )}
        <span>{formatAxisLabel(last?.date)}</span>
      </div>
    </div>
  );
}
