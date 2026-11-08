import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FirebaseAuthBoot from "./firebase-auth-boot";
import LanguageToggle from "./language-toggle";
import FloatingSupportButton from "./floating-support-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sakura",
  description:
    "Free Dota 2 cheat with camera distance, enemy resource bars, and a clean in-game menu.",
  icons: {
    icon: [
      {
        url: "/sakura.github.io/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/sakura.github.io/favicon.ico",
        type: "image/x-icon",
      },
    ],
    shortcut: "/sakura.github.io/icon.svg",
    apple: "/sakura.github.io/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <LanguageToggle />
        <FloatingSupportButton />
        <FirebaseAuthBoot />
      </body>
    </html>
  );
}
