"use client";

import { Heart, Sparkles, Stethoscope, ShieldCheck } from "lucide-react";

interface MascotProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showBadge?: boolean;
}

export function ClinicalMascot({ size = "lg", className = "", showBadge = true }: MascotProps) {
  const dimensions = {
    sm: { width: 64, height: 64 },
    md: { width: 96, height: 96 },
    lg: { width: 120, height: 120 },
  }[size];

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Floating Mascot Entity */}
      <div className="animate-float relative">
        {/* Ambient Vitality Glow */}
        <div className="absolute inset-0 -m-3 bg-gradient-to-tr from-emerald-300/30 via-teal-200/20 to-emerald-400/20 rounded-full blur-xl pointer-events-none" />

        {/* Mascot SVG */}
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-[0_8px_16px_rgba(17,56,43,0.14)]"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="mascotBody" x1="20" y1="20" x2="100" y2="105" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" />
              <stop offset="0.65" stopColor="#edf7f2" />
              <stop offset="1" stopColor="#d5ecdF" />
            </linearGradient>

            <linearGradient id="mascotEarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#256c54" />
              <stop offset="1" stopColor="#11382b" />
            </linearGradient>

            <linearGradient id="mascotCap" x1="30" y1="12" x2="90" y2="35" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1c5542" />
              <stop offset="1" stopColor="#0f3427" />
            </linearGradient>

            <linearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#e54867" />
              <stop offset="1" stopColor="#c52848" />
            </linearGradient>

            <radialGradient id="eyeShine" cx="30%" cy="30%" r="70%">
              <stop stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Stethoscope Neck Band */}
          <path
            d="M 32 64 C 32 88, 88 88, 88 64"
            stroke="#1b4d3c"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Stethoscope Bell Chest Piece */}
          <circle cx="60" cy="85" r="7" fill="#d49b35" stroke="#ffffff" strokeWidth="2" />
          <circle cx="60" cy="85" r="3" fill="#11382b" />

          {/* Front Desk Headset (Operator / Receptionist Communicator) */}
          <path
            d="M 24 54 C 24 24, 96 24, 96 54"
            stroke="#2b5e4c"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Headset Earcups */}
          <rect x="20" y="44" width="7" height="18" rx="3.5" fill="#11382b" stroke="#ffffff" strokeWidth="1.5" />
          <rect x="93" y="44" width="7" height="18" rx="3.5" fill="#11382b" stroke="#ffffff" strokeWidth="1.5" />
          {/* Headset Mic Boom */}
          <path
            d="M 25 56 C 25 74, 44 76, 50 73"
            stroke="#1b4d3c"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="51" cy="72" r="3" fill="#d49b35" />

          {/* Mascot Body & Head (Cute Friendly Capsule) */}
          <rect
            x="28"
            y="26"
            width="64"
            height="62"
            rx="30"
            fill="url(#mascotBody)"
            stroke="#b7ddcc"
            strokeWidth="2"
          />

          {/* Nurse/Doctor Clinical Cap */}
          <path
            d="M 38 34 C 44 20, 76 20, 82 34 Z"
            fill="url(#mascotCap)"
            stroke="#11382b"
            strokeWidth="1.5"
          />
          {/* Medical Cross on Cap */}
          <rect x="58" y="24" width="4" height="10" rx="1.5" fill="#ffffff" />
          <rect x="55" y="27" width="10" height="4" rx="1.5" fill="#ffffff" />

          {/* Expressive Eyes with Blink Animation */}
          <g className="animate-mascot-blink">
            {/* Left Eye */}
            <ellipse cx="46" cy="50" rx="4.5" ry="6" fill="#11382b" />
            <circle cx="44.5" cy="48" r="2" fill="#ffffff" />

            {/* Right Eye */}
            <ellipse cx="74" cy="50" rx="4.5" ry="6" fill="#11382b" />
            <circle cx="72.5" cy="48" r="2" fill="#ffffff" />
          </g>

          {/* Friendly Rosy Cheeks */}
          <ellipse cx="40" cy="56" rx="4" ry="2" fill="#f87171" opacity="0.35" />
          <ellipse cx="80" cy="56" rx="4" ry="2" fill="#f87171" opacity="0.35" />

          {/* Smiling Mouth */}
          <path
            d="M 54 58 Q 60 64 66 58"
            stroke="#11382b"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Little Floating Health Sparkles */}
          <g className="animate-sparkle" style={{ transformOrigin: "102px 30px" }}>
            <path
              d="M 102 24 L 104 28 L 108 30 L 104 32 L 102 36 L 100 32 L 96 30 L 100 28 Z"
              fill="#d49b35"
            />
          </g>
          <g className="animate-sparkle" style={{ transformOrigin: "16px 42px", animationDelay: "1.2s" }}>
            <path
              d="M 16 38 L 17.5 41 L 20 42.5 L 17.5 44 L 16 47 L 14.5 44 L 12 42.5 L 14.5 41 Z"
              fill="#256c54"
            />
          </g>

          {/* Medical Cross Emblem Badge on Chest */}
          <g style={{ transformOrigin: "60px 73px" }}>
            <circle cx="60" cy="73" r="8" fill="#ffffff" stroke="#26a69a" strokeWidth="1.5" />
            <rect x="58.5" y="68.5" width="3" height="9" rx="1" fill="#005d52" />
            <rect x="55.5" y="71.5" width="9" height="3" rx="1" fill="#005d52" />
          </g>
        </svg>
      </div>

      {/* Floating Dynamic Shadow Oval */}
      <div className="w-16 h-3 bg-[#11382b]/15 rounded-[100%] filter blur-[3px] animate-shadow-pulse -mt-1" />

      {/* Live Clinical Tag */}
      {showBadge && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#cce0d2] shadow-2xs text-[11px] font-semibold text-[#11382b]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Afiya AI · Better Care Starts Here</span>
        </div>
      )}
    </div>
  );
}
