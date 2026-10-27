import type { SVGProps } from "react";

export function ClinicLogoIcon({
  className = "h-10 w-10",
  pulseColor = "#34d399",
}: {
  className?: string;
  pulseColor?: string;
}) {
  return (
    <div
      className={`grid place-items-center rounded-full bg-[#004d40] shadow-sm shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={pulseColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3/5 w-3/5"
      >
        {/* Robot Assistant Icon */}
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </svg>
    </div>
  );
}

export function RobotChatIcon({
  className = "h-9 w-9",
}: {
  className?: string;
  strokeColor?: string;
}) {
  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none ${className}`}
      title="Afiya Clinical Mascot"
    >
      <img
        src="/mascot.svg"
        alt="Afiya Mascot"
        className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(17,56,43,0.18)] transition-transform hover:scale-110 duration-200"
      />
    </div>
  );
}

export const MascotChatIcon = RobotChatIcon;

export function BotanicalHero(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 160 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Main curved branch stem */}
      <path
        d="M30 215 C 45 170, 75 110, 140 25"
        stroke="#4a6856"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      
      {/* Leaves with soft natural tones */}
      {/* Leaf 1 - top right */}
      <path
        d="M138 25 C 145 10, 155 8, 158 5 C 152 20, 142 35, 138 25 Z"
        fill="#5a7d68"
      />
      {/* Leaf 2 */}
      <path
        d="M125 50 C 148 40, 158 52, 152 65 C 138 62, 128 56, 125 50 Z"
        fill="#668b74"
      />
      {/* Leaf 3 */}
      <path
        d="M110 80 C 85 70, 75 85, 82 98 C 96 95, 105 88, 110 80 Z"
        fill="#527560"
      />
      {/* Leaf 4 */}
      <path
        d="M95 110 C 122 102, 132 118, 125 132 C 110 128, 100 120, 95 110 Z"
        fill="#668b74"
      />
      {/* Leaf 5 */}
      <path
        d="M75 140 C 50 132, 40 148, 48 162 C 62 158, 70 150, 75 140 Z"
        fill="#527560"
      />
      {/* Leaf 6 */}
      <path
        d="M60 170 C 88 164, 98 182, 90 196 C 75 192, 65 182, 60 170 Z"
        fill="#5d826c"
      />
      {/* Leaf 7 bottom left */}
      <path
        d="M42 195 C 22 188, 15 202, 22 214 C 34 210, 39 204, 42 195 Z"
        fill="#4f715d"
      />
    </svg>
  );
}

export function BotanicalCorner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M15 88 C 25 65, 45 40, 85 10"
        stroke="#8ca695"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M85 10 C 92 2, 96 2, 98 0 C 93 10, 88 18, 85 10 Z"
        fill="#98b3a1"
      />
      <path
        d="M72 25 C 88 18, 94 26, 90 34 C 80 32, 74 28, 72 25 Z"
        fill="#a4bea9"
      />
      <path
        d="M58 45 C 42 38, 36 48, 41 56 C 50 54, 55 49, 58 45 Z"
        fill="#94af9d"
      />
      <path
        d="M45 65 C 62 60, 68 70, 63 78 C 53 76, 48 71, 45 65 Z"
        fill="#a4bea9"
      />
    </svg>
  );
}
