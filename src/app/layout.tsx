import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afiya",
  description:
    "Afiya Clinic intelligent front-desk assistant: approved clinic FAQs, structured symptom intake, safe emergency escalation, and live appointment booking. Better Care Starts Here.",
  icons: {
    icon: [
      { url: "/afiya-icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/afiya-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
