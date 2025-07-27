const STANDARD_COLOURS = [
  { name: "Black",   color: "#181822", accent: "#7de95a" },
  { name: "Blue",    color: "#2963FF", accent: "#85e085" },
  { name: "Red",     color: "#C83C3C", accent: "#FFB800" },
  { name: "Green",   color: "#1CC88A", accent: "#F0FFB7" },
  { name: "Purple",  color: "#7C3AED", accent: "#FFD6E0" },
  { name: "Grey",    color: "#8F8F99", accent: "#FFDB70" },
  { name: "White",   color: "#F6F6FB", accent: "#7de95a" },
  { name: "Yellow",  color: "#FFD600", accent: "#FFD6E0" },
  { name: "Pink",    color: "#FF89BB", accent: "#FFF3B0" },
];

export default function BinderCover({
  color = "#222234",
  accent = "#7de95a",
  text = "SixByFive TCG",
  elasticColor = "#181822",
  style = {}
}) {
  return (
    <svg
      width="160"
      height="200"
      viewBox="0 0 160 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", ...style }}
    >
      {/* Soft drop shadow */}
      <ellipse cx="80" cy="192" rx="64" ry="11" fill="#000" opacity="0.13" />
      
      {/* Binder body (softer corners) */}
      <rect
        x="12"
        y="12"
        width="136"
        height="176"
        rx="6"
        fill={color}
        stroke="#181822"
        strokeWidth="2"
      />

      {/* Gloss highlight (gentle, not washing out color) */}
      <defs>
        <linearGradient id="binder-gloss" x1="24" y1="20" x2="24" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.19" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x="20"
        y="18"
        width="90"
        height="46"
        rx="20"
        fill="url(#binder-gloss)"
      />

      {/* Elastic band (curved, softer look) */}
      <path
        d="M142 30 Q150 100 142 174"
        stroke={elasticColor}
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Elastic band shadow */}
      <path
        d="M144 30 Q152 100 144 174"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.11"
      />

      {/* Accent tab (smaller and rounder) */}
      <rect
        x="22"
        y="17"
        width="8"
        height="16"
        rx="5"
        fill={accent}
        className="drop-shadow-[0_1px_2px_#0002]"
      />

      {/* Branding text with shadow for contrast */}
      <text
        x="125"
        y="175"
        fontFamily="sans-serif"
        fontSize="16"
        fontWeight="bold"
        fill={color === "#F6F6FB" ? "#222234" : "#fff"}
        opacity="0.85"
        textAnchor="end"
        style={{
          letterSpacing: "0.01em",
          paintOrder: "stroke",
        }}
        className="drop-shadow-[0_2px_3px_#0006]"
      >
        {text}
      </text>

      {/* Decorative embossing line (thinner and softer) */}
      <rect
        x="20"
        y="22"
        width="1.5"
        height="156"
        rx="0.75"
        fill="#fff"
        opacity="0.08"
      />
    </svg>
  );
}

export { STANDARD_COLOURS };
