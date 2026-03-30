import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GlobalFullscreenShortcut } from "@/components/GlobalFullscreenShortcut";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Micronique",
    template: "%s | Micronique",
  },
  description:
    "Micronique — visite virtuelle 360° et informations sur nos ateliers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh h-full overflow-hidden">
        <GlobalFullscreenShortcut />
        {children}
      </body>
    </html>
  );
}
